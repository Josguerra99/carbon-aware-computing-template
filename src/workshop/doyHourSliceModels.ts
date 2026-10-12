import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";

/** Legacy: 366×24 slices with X = t (~1 point/year). Not the web workshop modes 1–3. */

export function doyHourKey(doy: number, solarHour: number): string {
  return `${doy}:${solarHour}`;
}

function bucketByDoyHour(
  trainingData: GhiSlot[],
): Map<string, { x: number; y: number }[]> {
  const buckets = new Map<string, { x: number; y: number }[]>();
  for (const row of trainingData) {
    const doy = MathHelper.dayOfYearUtc(row.time);
    const sh = MathHelper.solarHour(row.time, row.longitude);
    const key = doyHourKey(doy, sh);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push({ x: row.time.getTime(), y: row.ghiWm2 });
  }
  return buckets;
}

/** One linear model per (UTC doy, solarHour): x = time.getTime() across years. Up to 366×24 keys. */
export class LinearRegressionByDoyAndHour extends PredictionModel {
  private models = new Map<string, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    for (const [key, samples] of bucketByDoyHour(trainingData)) {
      if (samples.length >= 2) {
        this.models.set(key, MathHelper.createLinearRegression(samples));
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const key = doyHourKey(MathHelper.dayOfYearUtc(timestamp), MathHelper.solarHour(timestamp, longitude));
    const model = this.models.get(key);
    if (!model) {
      throw new Error("Model not trained for doy/hour");
    }
    return Math.max(0, model(timestamp.getTime()));
  }

  hasKey(doy: number, solarHour: number): boolean {
    return this.models.has(doyHourKey(doy, solarHour));
  }
}

export class PolynomialSplineByDoyAndHour extends PredictionModel {
  private models = new Map<string, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    for (const [key, samples] of bucketByDoyHour(trainingData)) {
      const model = MathHelper.createPolynomialSplineRegression(samples);
      if (model) {
        this.models.set(key, model);
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const key = doyHourKey(MathHelper.dayOfYearUtc(timestamp), MathHelper.solarHour(timestamp, longitude));
    const model = this.models.get(key);
    if (!model) {
      throw new Error("Model not trained for doy/hour");
    }
    return Math.max(0, model(timestamp.getTime()));
  }
}

/** Per (doy, solarHour) slice: single point per year → x = t (linear; spline if ≥8 years). */
export class SineCosineRegressionByDoyAndHour extends PredictionModel {
  private models = new Map<string, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    const buckets = new Map<string, { x: number; y: number }[]>();
    for (const row of trainingData) {
      const key = doyHourKey(MathHelper.dayOfYearUtc(row.time), MathHelper.solarHour(row.time, row.longitude));
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push({ x: row.time.getTime(), y: row.ghiWm2 });
    }
    for (const [key, samples] of buckets) {
      if (samples.length >= 2) {
        this.models.set(key, MathHelper.createLinearRegression(samples));
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const key = doyHourKey(MathHelper.dayOfYearUtc(timestamp), MathHelper.solarHour(timestamp, longitude));
    const model = this.models.get(key);
    if (!model) {
      throw new Error("Model not trained for doy/hour");
    }
    return Math.max(0, model(timestamp.getTime()));
  }
}
