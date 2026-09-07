import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { GhiHistoric, GhiSeriesJson, GhiSlot, HistoricDatasetInfo } from "./types";

const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL ?? "http://192.168.0.232:3915";

export namespace DataDownloader {
  const MAIN = MAIN_SERVER_URL.replace(/\/$/, "");
  const DATA_DIR = join(import.meta.dir, "..", "..", "cache");
  const HISTORIC_DIR = join(DATA_DIR, "");
  const mem = new Map<string, GhiHistoric>();

  function toDateSlots(historic: GhiSeriesJson): GhiSlot[] {
    return historic.slots.flatMap((slot) => {
      const time = new Date(slot.time ?? slot.start ?? "");
      if (Number.isNaN(time.getTime())) {
        return [];
      }
      return [{
        datasetId: historic.datasetId ?? "unknown",
        time,
        ghiWm2: slot.ghiWm2,
        cloudCoverPct: slot.cloudCoverPct,
        temperatureC: slot.temperatureC,
        latitude: historic.latitude,
        longitude: historic.longitude,
      }];
    });
  }

  function toHistoric(payload: GhiSeriesJson): GhiHistoric {
    return {
      datasetId: payload.datasetId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      slots: toDateSlots(payload),
    };
  }

  function hasCoords(payload: GhiSeriesJson): boolean {
    return Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude);
  }

  async function readJson(path: string): Promise<unknown | null> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    return file.json();
  }

  async function writeJson(path: string, payload: unknown) {
    await mkdir(join(path, ".."), { recursive: true });
    await Bun.write(path, JSON.stringify(payload));
  }

  export async function listHistoricDatasets(): Promise<HistoricDatasetInfo[]> {
    const url = `${MAIN}/api/historic/ghi`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo leer ${url}`);
    }
    const payload = (await response.json()) as { datasets?: HistoricDatasetInfo[] };
    const datasets = Array.isArray(payload.datasets) ? payload.datasets : [];
    return datasets.filter((dataset) => typeof dataset?.id === "string" && dataset.id.length > 0);
  }

  export async function loadHistoric(datasetId: string): Promise<GhiHistoric> {
    const cachedMem = mem.get(datasetId);
    if (cachedMem) {
      return cachedMem;
    }

    const path = join(HISTORIC_DIR, `${datasetId}.json`);
    const cached = await readJson(path);
    if (cached != null && hasCoords(cached as GhiSeriesJson)) {
      const historic = toHistoric(cached as GhiSeriesJson);
      mem.set(datasetId, historic);
      return historic;
    }

    const url = `${MAIN}/api/historic/ghi/${datasetId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo leer ${url}`);
    }
    const payload = (await response.json()) as GhiSeriesJson;
    if (!hasCoords(payload)) {
      throw new Error(`El histórico de ${datasetId} no trae latitude/longitude`);
    }
    await writeJson(path, payload);
    const historic = toHistoric(payload);
    mem.set(datasetId, historic);
    return historic;
  }
}
