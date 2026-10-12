import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";

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

export class SineCosineRegression extends PredictionModel {
    private models = new Map<number, (doy: number) => number>();

    async train(trainingData: GhiSlot[]): Promise<void> {
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
