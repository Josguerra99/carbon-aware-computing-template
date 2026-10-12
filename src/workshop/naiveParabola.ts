import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import { GhiSlot } from "../core/types";

export class NaiveParabola extends PredictionModel {

    static readonly START_HOUR_OF_DAY: number = 6;
    static readonly END_HOUR_OF_DAY: number = 19;
    static readonly MAX_KWH_PER_DAY: number = 990;

    private parabola: ((x: number) => number) | null = null;

    async train(trainingData: GhiSlot[]): Promise<void> {
        this.parabola = MathHelper.createParabola(
            NaiveParabola.MAX_KWH_PER_DAY,
            NaiveParabola.START_HOUR_OF_DAY,
            NaiveParabola.END_HOUR_OF_DAY,
        );
    }

    async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
        if (!this.parabola) throw new Error("Model not trained");
        return this.parabola(MathHelper.solarHour(timestamp, longitude));
    }
}
