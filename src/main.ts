import { ManualForecast } from "./core/manual";
import { MathHelper } from "./core/mathHelper";
import { PredictionModel } from "./core/predictionModel";
import type { GhiHistoric, GhiSlot } from "./core/types";
import {
  LinearRegression,
  LinearRegressionGlobal,
  LinearRegressionHourDoy,
} from "./workshop/linearRegression";
import { NaiveParabola } from "./workshop/naiveParabola";
import {
  PolynomialSpline,
  PolynomialSplineGlobal,
  PolynomialSplineHourDoy,
} from "./workshop/polynomialSpline";
import {
  SineCosineRegressionGlobal,
  SineCosineRegressionHourDoy,
  SineCosineRegressionHourTime,
} from "./workshop/sineCosineRegression";
import { HeliosComposer } from "./workshop/heliosComposer";
import { TfNeuralNetwork } from "./workshop/tfNeuralNetwork";
import { TfNeuralNetworkEnhanced } from "./workshop/tfNeuralNetworkEnhanced";
import { TfTransformer } from "./workshop/tfTransformer";

/** Local solar hour in [0, 24). Earth rotates 15° per hour; longitude is the timezone offset. */
function solarHour(timestamp: Date, longitude: number): number {
  const utc =
    timestamp.getUTCHours() +
    timestamp.getUTCMinutes() / 60 +
    timestamp.getUTCSeconds() / 3600;
  return Math.round(((utc + longitude / 15) % 24 + 24) % 24) % 24;
}

class SimplePredictionModel extends PredictionModel {


private trainingData: GhiSlot[]=[];
  /**
   * Entrena el modelo con los datos de entrenamiento.
   * Esta función es llamada una vez al inicio del programa.
   * @param datasets - Históricos por dataset
   * @returns void
   */
  async train(trainingData: GhiSlot[]): Promise<void> {

  
  }
 
  /**
   * Predice el GHI en un timestamp UTC.
   * @param timestamp - La fecha y hora UTC a predecir.
   * @param latitude - Latitud del dataset pedido.
   * @param longitude - Longitud del dataset pedido.
   * @returns El valor del GHI predicho.
   */
  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    return 0;
  }
}

// Modes (see workshop/workshopModes.ts — same as website teaching pages):
// Mode 1 Global: LinearRegressionGlobal | PolynomialSplineGlobal | SineCosineRegressionGlobal
// Mode 2 HourTime (24×, X=t): LinearRegression | PolynomialSpline | SineCosineRegressionHourTime
// Mode 3 HourDoy (24×, X=doy): LinearRegressionHourDoy | PolynomialSplineHourDoy | SineCosineRegressionHourDoy
// export const WorkshopModel = new LinearRegressionGlobal();
// export const WorkshopModel = new LinearRegression();
// export const WorkshopModel = new LinearRegressionHourDoy();
// export const WorkshopModel = new PolynomialSplineGlobal();
// export const WorkshopModel = new PolynomialSpline();
// export const WorkshopModel = new PolynomialSplineHourDoy();
// export const WorkshopModel = new SineCosineRegressionGlobal();
// export const WorkshopModel = new SineCosineRegressionHourTime();
export const WorkshopModel = new SineCosineRegressionHourDoy();
// export const WorkshopModel = new NaiveParabola();
// export const WorkshopModel = new HeliosComposer();
// export const WorkshopModel = new TfNeuralNetwork();
// export const WorkshopModel = new TfNeuralNetworkEnhanced();
// export const WorkshopModel = new TfTransformer();
// export const WorkshopModel = new NaiveParabola();
