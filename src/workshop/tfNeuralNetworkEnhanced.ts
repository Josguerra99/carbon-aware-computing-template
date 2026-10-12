import * as tf from "@tensorflow/tfjs";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
import {
  ENHANCED_FEATURE_COUNT,
  type TfTrainingConfig,
  defaultEnhancedTfTrainingConfig,
  predictEnhancedNonNegative,
  trainEnhancedKerasRegressor,
} from "./tfEnhancedCommon";

/** Dense regressor on sin/cos solar + seasonal features (smoother than one-hot hours). */
export class TfNeuralNetworkEnhanced extends PredictionModel {
  private model: tf.LayersModel | null = null;
  private readonly config: TfTrainingConfig;

  constructor(config: Partial<TfTrainingConfig> = {}) {
    super();
    this.config = { ...defaultEnhancedTfTrainingConfig, ...config, epochs: config.epochs ?? 15 };
  }

  async train(trainingData: GhiSlot[]): Promise<void> {
    const model = tf.sequential({
      layers: [
        tf.layers.inputLayer({ inputShape: [ENHANCED_FEATURE_COUNT] }),
        tf.layers.dense({ units: 256, activation: "relu" }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 128, activation: "relu" }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 64, activation: "relu" }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: 1 }),
      ],
    });
    await trainEnhancedKerasRegressor(model, trainingData, this.config);
    this.model?.dispose();
    this.model = model;
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    if (!this.model) {
      throw new Error("Model not trained");
    }
    return predictEnhancedNonNegative(this.model, timestamp, latitude, longitude);
  }
}
