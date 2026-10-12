import * as tf from "@tensorflow/tfjs";
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology.js";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
import {
  HELIOS_FEATURE_COUNT,
  type HeliosTrainingConfig,
  defaultHeliosTrainingConfig,
  predictHeliosBatch,
  trainHeliosModel,
} from "./heliosFeatures";

/**
 * **HeliosComposer** — default “best effort” workshop regressor for global GHI.
 * (Nickname from your “composer workshop delivery” idea: composes sun, season, and place.)
 */
export class HeliosComposer extends PredictionModel {
  private model: tf.LayersModel | null = null;
  private readonly config: HeliosTrainingConfig;

  constructor(config: Partial<HeliosTrainingConfig> = {}) {
    super();
    this.config = { ...defaultHeliosTrainingConfig, ...config };
  }

  private static buildNetwork(): tf.LayersModel {
    const input = tf.input({ shape: [HELIOS_FEATURE_COUNT], name: "helios_features" });
    let x = tf.layers.dense({ units: 512, activation: "relu", name: "d512" }).apply(input) as tf.SymbolicTensor;
    x = tf.layers.layerNormalization({ epsilon: 1e-6, name: "ln1" }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dropout({ rate: 0.12, name: "drop1" }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dense({ units: 256, activation: "relu", name: "d256" }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dropout({ rate: 0.08, name: "drop2" }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dense({ units: 128, activation: "relu", name: "d128" }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dense({ units: 64, activation: "relu", name: "d64" }).apply(x) as tf.SymbolicTensor;
    const output = tf.layers.dense({ units: 1, name: "ghi_wm2" }).apply(x) as tf.SymbolicTensor;
    return tf.model({ inputs: input, outputs: output, name: "helios_composer" });
  }

  async train(trainingData: GhiSlot[]): Promise<void> {
    const model = HeliosComposer.buildNetwork();
    await trainHeliosModel(model, trainingData, this.config);
    this.model?.dispose();
    this.model = model;
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    if (!this.model) {
      throw new Error("Model not trained");
    }
    const [value] = await predictHeliosBatch(this.model, [timestamp], latitude, longitude);
    return value;
  }
}

/** Alias if you prefer the longer workshop codename. */
export const ComposerWorkshopDelivery = HeliosComposer;
