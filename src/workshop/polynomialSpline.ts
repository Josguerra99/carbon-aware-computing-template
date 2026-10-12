import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
import { bucketTrainingBySolarHour, xDoyUtc, xTimeMs } from "./hourGrouping";

/** Mode 1 — global spline, X = time.getTime(). */
export class PolynomialSplineGlobal extends PredictionModel {
  private predictTime: ((x: number) => number) | null = null;

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.predictTime = MathHelper.createPolynomialSplineRegression(
      trainingData.map((data) => ({ x: data.time.getTime(), y: data.ghiWm2 })),
    );
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    if (!this.predictTime) {
      throw new Error("Model not trained");
    }
    return Math.max(0, this.predictTime(timestamp.getTime()));
  }
}

/** Mode 2 — one spline per solarHour, X = time.getTime(). */
export class PolynomialSpline extends PredictionModel {
  private models = new Map<number, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    for (const [solarHour, rows] of bucketTrainingBySolarHour(trainingData, xTimeMs)) {
      const model = MathHelper.createPolynomialSplineRegression(rows);
      if (model) {
        this.models.set(solarHour, model);
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const solarHour = MathHelper.solarHour(timestamp, longitude);
    const model = this.models.get(solarHour);
    if (!model) {
      throw new Error("Model not trained");
    }
    return Math.max(0, model(timestamp.getTime()));
  }
}

/** Mode 3 — one spline per solarHour, X = dayOfYearUtc. */
export class PolynomialSplineHourDoy extends PredictionModel {
  private models = new Map<number, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    for (const [solarHour, rows] of bucketTrainingBySolarHour(trainingData, xDoyUtc)) {
      const model = MathHelper.createPolynomialSplineRegression(rows);
      if (model) {
        this.models.set(solarHour, model);
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const solarHour = MathHelper.solarHour(timestamp, longitude);
    const model = this.models.get(solarHour);
    if (!model) {
      throw new Error("Model not trained");
    }
    return Math.max(0, model(MathHelper.dayOfYearUtc(timestamp)));
  }
}
