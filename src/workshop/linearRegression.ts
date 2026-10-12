import { MathHelper } from "../core/mathHelper";
import { PredictionModel } from "../core/predictionModel";
import { GhiSlot } from "../core/types";

export class LinearRegressionGlobal extends PredictionModel {
    private linearRegression: ((x: number) => number) | null = null;
    async train(trainingData: GhiSlot[]): Promise<void> {

        //Let's create a linear regression for the entire dataset
        this.linearRegression = MathHelper.createLinearRegression(trainingData.map(data => ({ x: data.time.getTime(), y: data.ghiWm2 })));
    }

    async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
        if (!this.linearRegression) throw new Error("Model not trained");
        return this.linearRegression(MathHelper.solarHour(timestamp, longitude));
    }
}


export class LinearRegression extends PredictionModel {

    private linearRegressions: Map<number, (x: number) => number> = new Map();
    async train(trainingData: GhiSlot[]): Promise<void> {

        //Let's group the data by solar hour
        const solarHours = new Map<number, { x: number, y: number }[]>();
        for (const data of trainingData) {
            const solarHour = MathHelper.solarHour(data.time, data.longitude);
            if (!solarHours.has(solarHour)) solarHours.set(solarHour, []);
            solarHours.get(solarHour)!.push({ x: data.time.getTime(), y: data.ghiWm2 });
        }

        //Now let's create a linear regression for each solar hour
        for (const [solarHour, data] of solarHours) {
            this.linearRegressions.set(solarHour, MathHelper.createLinearRegression(data));
        }
    }
    async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
        const solarHour = MathHelper.solarHour(timestamp, longitude);
        if (!this.linearRegressions.has(solarHour)) throw new Error("Model not trained");
        return this.linearRegressions.get(solarHour)!(timestamp.getTime());
    }
}