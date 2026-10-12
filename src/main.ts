import { PredictionModel } from "./core/predictionModel";
import type { GhiHistoric, GhiSlot } from "./core/types";

class SimplePredictionModel extends PredictionModel {
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

export const WorkshopModel = new SimplePredictionModel();
