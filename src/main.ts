import * as tf from "@tensorflow/tfjs";
import type { GhiSlot } from "./types";

/**
 * Entrena y predice aquí. `slots` es el GHI histórico del dataset
 * pedido. La siguiente hora sale de la última de esa serie.
 * `time` es Date, igual que la columna time del CSV.
 * `gtHour` es 0–23 y `gtDate` es YYYY-MM-DD, ambos en Guatemala.
 * `hours` es cuántas horas hay que predecir, en orden, a partir
 * de la hora siguiente a la última de `slots`.
 * Devuelve solo `predWm2` para esas horas, sin fecha: el primero
 * es la siguiente hora, el segundo la que sigue, y así.
 */
export async function forecast(slots: GhiSlot[], hours: number): Promise<number[]> {
  return [];
}
