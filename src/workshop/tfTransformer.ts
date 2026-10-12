import type { LayersModel } from "@tensorflow/tfjs";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
import {
  ENHANCED_FEATURE_COUNT,
  type TfTrainingConfig,
  defaultEnhancedTfTrainingConfig,
  predictEnhancedNonNegative,
  trainEnhancedKerasRegressor,
} from "./tfEnhancedCommon";
import { buildTabularTransformer } from "./tfTabularTransformer";

/**
 * Tabular transformer on enhanced sin/cos features (one token per feature).
 * For full multi-head attention, use examples/workshop/tf_transformer.py in WSL.
 */
export class TfTransformer extends PredictionModel {
  private model: LayersModel | null = null;
  private readonly config: TfTrainingConfig;

  constructor(config: Partial<TfTrainingConfig> = {}) {
    super();
    this.config = {
      ...defaultEnhancedTfTrainingConfig,
      ...config,
      epochs: config.epochs ?? 12,
      batchSize: config.batchSize ?? 4096,
      learningRate: config.learningRate ?? 5e-4,
    };
  }

  async train(trainingData: GhiSlot[]): Promise<void> {
    const model = buildTabularTransformer({ featureCount: ENHANCED_FEATURE_COUNT });
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
