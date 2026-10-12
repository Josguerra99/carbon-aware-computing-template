import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import { GhiSlot } from "../core/types";
import { bucketTrainingBySolarHour, xDoyUtc, xTimeMs } from "./hourGrouping";

/** Mode 1 — global linear regression, X = time.getTime(). */
export class LinearRegressionGlobal extends PredictionModel {
  private linearRegression: ((x: number) => number) | null = null;

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.linearRegression = MathHelper.createLinearRegression(
      trainingData.map((data) => ({ x: data.time.getTime(), y: data.ghiWm2 })),
    );
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    if (!this.linearRegression) {
      throw new Error("Model not trained");
    }
    return this.linearRegression(timestamp.getTime());
  }
}

/** Mode 2 — one linear model per solarHour, X = time.getTime(). */
export class LinearRegression extends PredictionModel {
  private linearRegressions = new Map<number, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.linearRegressions.clear();
    for (const [solarHour, data] of bucketTrainingBySolarHour(trainingData, xTimeMs)) {
      this.linearRegressions.set(solarHour, MathHelper.createLinearRegression(data));
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const solarHour = MathHelper.solarHour(timestamp, longitude);
    const predict = this.linearRegressions.get(solarHour);
    if (!predict) {
      throw new Error("Model not trained");
    }
    return predict(timestamp.getTime());
  }
}

/** Mode 3 — one linear model per solarHour, X = dayOfYearUtc. */
export class LinearRegressionHourDoy extends PredictionModel {
  private linearRegressions = new Map<number, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.linearRegressions.clear();
    for (const [solarHour, data] of bucketTrainingBySolarHour(trainingData, xDoyUtc)) {
      this.linearRegressions.set(solarHour, MathHelper.createLinearRegression(data));
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const solarHour = MathHelper.solarHour(timestamp, longitude);
    const predict = this.linearRegressions.get(solarHour);
    if (!predict) {
      throw new Error("Model not trained");
    }
    return predict(MathHelper.dayOfYearUtc(timestamp));
  }
}
