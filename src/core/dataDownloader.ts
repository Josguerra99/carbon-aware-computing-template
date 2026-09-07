import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { GhiSeriesJson, GhiSlot } from "./types";

const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL ?? "http://192.168.0.232:3915";

export namespace DataDownloader {
  const MAIN = MAIN_SERVER_URL.replace(/\/$/, "");
  const DATA_DIR = join(import.meta.dir, "..", "..","cache");
  const HISTORIC_DIR = join(DATA_DIR, "");

  function toDateSlots(historic: GhiSeriesJson): GhiSlot[] {
    return historic.slots.flatMap((slot) => {
      const time = new Date(slot.time ?? slot.start ?? "");
      if (Number.isNaN(time.getTime())) {
        return [];
      }
      return [{
        time,
        ghiWm2: slot.ghiWm2,
        cloudCoverPct: slot.cloudCoverPct,
        temperatureC: slot.temperatureC,
      }];
    });
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

  export async function loadHistoric(datasetId: string): Promise<GhiSlot[]> {
    const path = join(HISTORIC_DIR, `${datasetId}.json`);
    const cached = await readJson(path);
    if (cached != null) {
      return toDateSlots(cached as GhiSeriesJson);
    }
    const url = `${MAIN}/api/historic/ghi/${datasetId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo leer ${url}`);
    }
    const payload = (await response.json()) as GhiSeriesJson;
    await writeJson(path, payload);
    return toDateSlots(payload);
  }
}
