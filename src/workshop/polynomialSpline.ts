import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";

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

export class PolynomialSpline extends PredictionModel {
    private models = new Map<number, (x: number) => number>();

    async train(trainingData: GhiSlot[]): Promise<void> {
        const bySolarHour = new Map<number, { x: number; y: number }[]>();
        for (const data of trainingData) {
            const solarHour = MathHelper.solarHour(data.time, data.longitude);
            if (!bySolarHour.has(solarHour)) {
                bySolarHour.set(solarHour, []);
            }
            bySolarHour.get(solarHour)!.push({
                x: data.time.getTime(),
                y: data.ghiWm2,
            });
        }

        for (const [solarHour, rows] of bySolarHour) {
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
