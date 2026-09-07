import { GhiSlot } from "./types";

export abstract class PredictionModel {
  abstract train(trainingData: GhiSlot[]): Promise<void>;
  abstract forecast(timestamp: Date): Promise<number>;
}
