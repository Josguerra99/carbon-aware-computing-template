import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
/** Mode 1 — sin/cos vs dayOfYearUtc on all training rows. */
export class SineCosineRegressionGlobal extends PredictionModel {
    private predictDoy: ((doy: number) => number) | null = null;

    async train(trainingData: GhiSlot[]): Promise<void> {
        this.predictDoy = MathHelper.createSineCosineRegression(
            trainingData.map((data) => ({
                doy: MathHelper.dayOfYearUtc(data.time),
                y: data.ghiWm2,
            })),
        );
    }

    async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
        if (!this.predictDoy) {
            throw new Error("Model not trained");
        }
        return Math.max(0, this.predictDoy(MathHelper.dayOfYearUtc(timestamp)));
    }
}

/** Mode 2 — 24 sin/cos models (one per solarHour), X = time.getTime(). */
export class SineCosineRegressionHourTime extends PredictionModel {
    private models = new Map<number, (tMs: number) => number>();

    async train(trainingData: GhiSlot[]): Promise<void> {
        this.models.clear();
        const pointsBySolarHour = new Map<number, { x: number; y: number }[]>();
        for (const row of trainingData) {
            const solarHour = MathHelper.solarHour(row.time, row.longitude);
            let points = pointsBySolarHour.get(solarHour);
            if (!points) {
                points = [];
                pointsBySolarHour.set(solarHour, points);
            }
            points.push({ x: row.time.getTime(), y: row.ghiWm2 });
        }
        for (const [solarHour, rows] of pointsBySolarHour) {
            const model = MathHelper.createSineCosineRegressionOnTimeMs(rows);
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

/** Mode 3 — 24 sin/cos models (one per solarHour), X = dayOfYearUtc. */
export class SineCosineRegressionHourDoy extends PredictionModel {
    private models = new Map<number, (doy: number) => number>();

    async train(trainingData: GhiSlot[]): Promise<void> {
        this.models.clear();
        const bySolarHour = new Map<number, { doy: number; y: number }[]>();
        for (const data of trainingData) {
            const solarHour = MathHelper.solarHour(data.time, data.longitude);
            if (!bySolarHour.has(solarHour)) {
                bySolarHour.set(solarHour, []);
            }
            bySolarHour.get(solarHour)!.push({
                doy: MathHelper.dayOfYearUtc(data.time),
                y: data.ghiWm2,
            });
        }

        for (const [solarHour, rows] of bySolarHour) {
            const model = MathHelper.createSineCosineRegression(rows);
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

/** @deprecated Prefer `SineCosineRegressionHourDoy` (symmetric with `LinearRegressionHourDoy`). */
export { SineCosineRegressionHourDoy as SineCosineRegression };
