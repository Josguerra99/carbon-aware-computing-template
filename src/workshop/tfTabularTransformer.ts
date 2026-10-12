import * as tf from "@tensorflow/tfjs";
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology.js";

export type TabularTransformerOptions = {
  featureCount: number;
  dModel?: number;
  ffDim?: number;
  dropout?: number;
};

/**
 * Tabular transformer block for TF.js: each feature is a token; Conv1D over the
 * full token axis mixes all features (single global attention-like step), then FFN.
 * Python template uses full MultiHeadAttention; MHA symbolic build is flaky in tfjs 4.x.
 */
export function buildTabularTransformer(options: TabularTransformerOptions): tf.LayersModel {
  const featureCount = options.featureCount;
  const dModel = options.dModel ?? 32;
  const ffDim = options.ffDim ?? 64;
  const dropout = options.dropout ?? 0.1;

  const inputs = tf.input({ shape: [featureCount], name: "features" });
  let tokens = tf.layers.reshape({ targetShape: [featureCount, 1] }).apply(inputs) as SymbolicTensor;
  tokens = tf.layers.dense({ units: dModel, name: "token_proj" }).apply(tokens) as SymbolicTensor;
  tokens = tf.layers.layerNormalization({ epsilon: 1e-6, name: "ln_pre" }).apply(tokens) as SymbolicTensor;

  tokens = tf.layers
    .conv1d({
      filters: dModel,
      kernelSize: featureCount,
      padding: "valid",
      activation: "linear",
      name: "token_mix",
    })
    .apply(tokens) as SymbolicTensor;
  tokens = tf.layers.dropout({ rate: dropout, name: "mix_drop" }).apply(tokens) as SymbolicTensor;
  tokens = tf.layers.layerNormalization({ epsilon: 1e-6, name: "ln_mix" }).apply(tokens) as SymbolicTensor;

  let ff = tf.layers.dense({ units: ffDim, activation: "relu", name: "ff1" }).apply(tokens) as SymbolicTensor;
  ff = tf.layers.dense({ units: dModel, name: "ff2" }).apply(ff) as SymbolicTensor;
  ff = tf.layers.dropout({ rate: dropout, name: "ff_drop" }).apply(ff) as SymbolicTensor;
  tokens = tf.layers.add({ name: "ff_res" }).apply([tokens, ff]) as SymbolicTensor;
  tokens = tf.layers.layerNormalization({ epsilon: 1e-6, name: "ln_out" }).apply(tokens) as SymbolicTensor;

  tokens = tf.layers.flatten({ name: "flatten" }).apply(tokens) as SymbolicTensor;
  const outputs = tf.layers.dense({ units: 1, name: "regression" }).apply(tokens) as SymbolicTensor;

  return tf.model({ inputs, outputs, name: "tf_tabular_transformer" });
}
