import { historicStore } from "./historicStore";
import type { GhiHistoric, HistoricDatasetInfo } from "./types";

/** @deprecated Use historicStore.getTrain / getMeta. Kept so older imports still load training series. */
export namespace DataDownloader {
  export function listHistoricDatasets(): Promise<HistoricDatasetInfo[]> {
    return historicStore.listDatasets();
  }

  export function loadHistoric(datasetId: string): Promise<GhiHistoric> {
    return historicStore.getTrain(datasetId);
  }
}
