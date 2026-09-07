import { DataDownloader } from "./core/dataDownloader";
import type { GhiSlot } from "./core/types";

export namespace LoadTrainingData {
  export async function load(): Promise<GhiSlot[]> {
    const datasets = await DataDownloader.listHistoricDatasets();
    const response = await Promise.all(datasets.map((dataset) => DataDownloader.loadHistoric(dataset.id)));
    return response.flatMap((dataset) => dataset.slots);
  }
}
