import { DataDownloader } from "./core/dataDownloader";
import { Logger } from "./core/debugLogs";
import { GhiSlot } from "./core/types";

export namespace LoadTrainingData {
  export async function load(): Promise<GhiSlot[]> {
    Logger.log("Loading training data...");
    return await DataDownloader.loadHistoric("chiquimula");
  }
}
