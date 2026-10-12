import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";

/** Legacy: one model per calendar doy (X = t that day). Not web modes 1–3 (hour + optional doy as X). */

function rowsForDoy(trainingData: GhiSlot[], doy: number): GhiSlot[] {
  return trainingData.filter((row) => MathHelper.dayOfYearUtc(row.time) === doy);
}

/** One linear regression per UTC doy: x = time.getTime(), y = GHI (that calendar day across years). */
export class LinearRegressionByDoy extends PredictionModel {
  private models = new Map<number, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    const byDoy = new Map<number, { x: number; y: number }[]>();
    for (const row of trainingData) {
      const doy = MathHelper.dayOfYearUtc(row.time);
      if (!byDoy.has(doy)) {
        byDoy.set(doy, []);
      }
      byDoy.get(doy)!.push({ x: row.time.getTime(), y: row.ghiWm2 });
    }
    for (const [doy, samples] of byDoy) {
      if (samples.length >= 2) {
        this.models.set(doy, MathHelper.createLinearRegression(samples));
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const doy = MathHelper.dayOfYearUtc(timestamp);
    const model = this.models.get(doy);
    if (!model) {
      throw new Error("Model not trained for doy");
    }
    return Math.max(0, model(timestamp.getTime()));
  }

  hasDoy(doy: number): boolean {
    return this.models.has(doy);
  }
}

/** One polynomial spline per UTC doy: x = time.getTime() on that day's history. */
export class PolynomialSplineByDoy extends PredictionModel {
  private models = new Map<number, (x: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    const byDoy = new Map<number, { x: number; y: number }[]>();
    for (const row of trainingData) {
      const doy = MathHelper.dayOfYearUtc(row.time);
      if (!byDoy.has(doy)) {
        byDoy.set(doy, []);
      }
      byDoy.get(doy)!.push({ x: row.time.getTime(), y: row.ghiWm2 });
    }
    for (const [doy, samples] of byDoy) {
      const model = MathHelper.createPolynomialSplineRegression(samples);
      if (model) {
        this.models.set(doy, model);
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const doy = MathHelper.dayOfYearUtc(timestamp);
    const model = this.models.get(doy);
    if (!model) {
      throw new Error("Model not trained for doy");
    }
    return Math.max(0, model(timestamp.getTime()));
  }
}

/**
 * One sin/cos model per UTC doy: seasonal hour shape within that calendar day
 * (feature "doy" slot holds solarHour 0–23).
 */
export class SineCosineRegressionByDoy extends PredictionModel {
  private models = new Map<number, (doyFeature: number) => number>();

  async train(trainingData: GhiSlot[]): Promise<void> {
    this.models.clear();
    const byDoy = new Map<number, { doy: number; y: number }[]>();
    for (const row of trainingData) {
      const doy = MathHelper.dayOfYearUtc(row.time);
      if (!byDoy.has(doy)) {
        byDoy.set(doy, []);
      }
      byDoy.get(doy)!.push({
        doy: MathHelper.solarHour(row.time, row.longitude),
        y: row.ghiWm2,
      });
    }
    for (const [doy, samples] of byDoy) {
      const model = MathHelper.createSineCosineRegression(samples);
      if (model) {
        this.models.set(doy, model);
      }
    }
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    const doy = MathHelper.dayOfYearUtc(timestamp);
    const model = this.models.get(doy);
    if (!model) {
      throw new Error("Model not trained for doy");
    }
    const sh = MathHelper.solarHour(timestamp, longitude);
    return Math.max(0, model(sh));
  }
}

export { rowsForDoy };
