import { MAIN_SERVER_URL } from "../config/env";
import type { GhiSeriesJson, HistoricDatasetInfo } from "./types";

export type WorkshopManifest = {
  configId: string;
  configName: string;
  scenarioCount: number;
  datasetsHash: string;
  /** Changes when any scenario CSV file changes (size/mtime). */
  csvBundleHash?: string;
  generatedAt: string;
};

export type DatasetMeta = {
  configId?: string;
  datasetId: string;
  name?: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  kind?: string;
  csvFingerprint?: string;
};

export type WorkshopClient = {
  fetchManifest(): Promise<WorkshopManifest>;
  fetchMeta(datasetId: string): Promise<DatasetMeta>;
  fetchTrainSeries(datasetId: string): Promise<GhiSeriesJson & { configId?: string }>;
  listDatasets(): Promise<{ configId?: string; datasets: HistoricDatasetInfo[] }>;
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${url} (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

export function createWorkshopClient(baseUrl = MAIN_SERVER_URL): WorkshopClient {
  const main = baseUrl.replace(/\/$/, "");
  return {
    fetchManifest() {
      return readJson<WorkshopManifest>(`${main}/api/workshop/manifest`);
    },
    fetchMeta(datasetId: string) {
      return readJson<DatasetMeta>(
        `${main}/api/workshop/datasets/${encodeURIComponent(datasetId)}/meta`,
      );
    },
    fetchTrainSeries(datasetId: string) {
      return readJson(`${main}/api/historic/ghi/${encodeURIComponent(datasetId)}/train`);
    },
    async listDatasets() {
      const payload = await readJson<{ configId?: string; datasets?: HistoricDatasetInfo[] }>(
        `${main}/api/historic/ghi`,
      );
      const datasets = Array.isArray(payload.datasets) ? payload.datasets : [];
      return {
        configId: payload.configId,
        datasets: datasets.filter((dataset) => typeof dataset?.id === "string" && dataset.id.length > 0),
      };
    },
  };
}
