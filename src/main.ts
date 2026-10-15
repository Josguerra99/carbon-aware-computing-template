import { PredictionModel } from "./core/predictionModel";
import type { GhiSlot } from "./core/types";
import { LinearRegressionByDoyAndHour, PolynomialSplineByDoyAndHour, SineCosineRegressionByDoyAndHour } from "./workshop/doyHourSliceModels";
import { LinearRegressionByDoy, PolynomialSplineByDoy, SineCosineRegressionByDoy } from "./workshop/doySliceModels";
import { PolynomialSpline } from "./workshop/polynomialSpline";
import { SineCosineRegression } from "./workshop/sineCosineRegression";
import { WorkshopModelInstance } from "./workshop/workshopTest";

class MyPredictionModel extends PredictionModel {
  /**
   * Entrena el modelo con los datos de entrenamiento.
   * Se llama una vez al arrancar el servidor.
   */
  async train(trainingData: GhiSlot[]): Promise<void> {
  }

  /**
   * Predice el GHI en un timestamp UTC.
   */
  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    return 0;
  }
}

export const WorkshopModel = new MyPredictionModel();
