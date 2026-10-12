import * as tf from "@tensorflow/tfjs";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
import {
  FEATURE_COUNT,
  type TfTrainingConfig,
  defaultTfTrainingConfig,
  predictNonNegative,
  trainKerasRegressor,
} from "./tfCommon";

export class TfNeuralNetwork extends PredictionModel {
  private model: tf.LayersModel | null = null;
  private readonly config: TfTrainingConfig;

  constructor(config: Partial<TfTrainingConfig> = {}) {
    super();
    this.config = { ...defaultTfTrainingConfig, ...config, epochs: config.epochs ?? 15 };
  }

  async train(trainingData: GhiSlot[]): Promise<void> {
    const model = tf.sequential({
      layers: [
        tf.layers.inputLayer({ inputShape: [FEATURE_COUNT] }),
        tf.layers.dense({ units: 256, activation: "relu" }),
        tf.layers.dense({ units: 128, activation: "relu" }),
        tf.layers.dense({ units: 64, activation: "relu" }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: 1 }),
      ],
    });
    await trainKerasRegressor(model, trainingData, this.config);
    this.model?.dispose();
    this.model = model;
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    if (!this.model) {
      throw new Error("Model not trained");
    }
    return predictNonNegative(this.model, timestamp, latitude, longitude);
  }
}
