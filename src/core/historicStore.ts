import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HISTORIC_CACHE_TTL_MS, REFRESH_HISTORIC } from "../config/env";
import type { GhiHistoric, GhiSeriesJson, GhiSlot, HistoricDatasetInfo } from "./types";
import { cacheBundleMatches, manifestCacheStale } from "./cache-bundle";
import {
  createWorkshopClient,
  type DatasetMeta,
  type WorkshopClient,
  type WorkshopManifest,
} from "./workshopClient";

type DiskEnvelope<T> = {
  configId: string;
  csvBundleHash?: string;
  csvFingerprint?: string;
  fetchedAt: number;
  payload: T;
};

type MemEntry = {
  configId: string;
  csvBundleHash?: string;
  meta?: DatasetMeta;
  metaFetchedAt?: number;
  train?: GhiHistoric;
  trainFetchedAt?: number;
};

function toDateSlots(historic: GhiSeriesJson): GhiSlot[] {
  return historic.slots.flatMap((slot) => {
    const time = new Date(slot.time ?? slot.start ?? "");
    if (Number.isNaN(time.getTime())) {
      return [];
    }
    return [
      {
        datasetId: historic.datasetId ?? "unknown",
        time,
        ghiWm2: slot.ghiWm2,
        cloudCoverPct: slot.cloudCoverPct,
        temperatureC: slot.temperatureC,
        latitude: historic.latitude,
        longitude: historic.longitude,
      },
    ];
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

function hasCoords(payload: { latitude?: number; longitude?: number }): boolean {
  return Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude);
}

function fresh(fetchedAt: number | undefined, ttlMs: number): boolean {
  if (fetchedAt == null) {
    return false;
  }
  if (ttlMs <= 0) {
    return true;
  }
  return Date.now() - fetchedAt < ttlMs;
}

export type HistoricStoreOptions = {
  client: WorkshopClient;
  cacheDir: string;
  ttlMs?: number;
  /** Skip disk reads and refetch (still writes the new cache). */
  refresh?: boolean;
};

export function createHistoricStore(options: HistoricStoreOptions) {
  const ttlMs = options.ttlMs ?? HISTORIC_CACHE_TTL_MS;
  const bypassDisk = options.refresh ?? false;
  const mem = new Map<string, MemEntry>();
  let manifest: WorkshopManifest | null = null;

  async function readJson<T>(path: string): Promise<T | null> {
    try {
      const text = await readFile(path, "utf8");
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function writeJson(path: string, payload: unknown) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(payload));
  }

  async function clearDisk() {
    await rm(join(options.cacheDir, "meta"), { recursive: true, force: true });
    await rm(join(options.cacheDir, "train"), { recursive: true, force: true });
  }

  async function ensureManifest(): Promise<WorkshopManifest> {
    if (manifest) {
      return manifest;
    }
    const remote = await options.client.fetchManifest();
    const disk = bypassDisk
      ? null
      : await readJson<WorkshopManifest>(join(options.cacheDir, "manifest.json"));
    if (manifestCacheStale(disk, remote)) {
      mem.clear();
      await clearDisk();
    }
    if (bypassDisk) {
      mem.clear();
    }
    manifest = remote;
    await writeJson(join(options.cacheDir, "manifest.json"), remote);
    return remote;
  }

  function entry(datasetId: string, configId: string, csvBundleHash?: string): MemEntry {
    const current = mem.get(datasetId);
    if (
      current &&
      current.configId === configId &&
      (csvBundleHash == null || current.csvBundleHash === csvBundleHash)
    ) {
      return current;
    }
    const next: MemEntry = { configId, csvBundleHash };
    mem.set(datasetId, next);
    return next;
  }

  async function getMeta(datasetId: string): Promise<DatasetMeta> {
    const current = await ensureManifest();
    const cached = mem.get(datasetId);
    if (
      cached?.configId === current.configId &&
      cached.csvBundleHash === current.csvBundleHash &&
      cached.meta &&
      hasCoords(cached.meta) &&
      fresh(cached.metaFetchedAt, ttlMs)
    ) {
      return cached.meta;
    }
    if (!bypassDisk) {
      const disk = await readJson<DiskEnvelope<DatasetMeta>>(
        join(options.cacheDir, "meta", `${datasetId}.json`),
      );
      if (
        disk &&
        cacheBundleMatches(disk, current) &&
        hasCoords(disk.payload) &&
        fresh(disk.fetchedAt, ttlMs)
      ) {
        const row = entry(datasetId, current.configId, current.csvBundleHash);
        row.meta = disk.payload;
        row.metaFetchedAt = disk.fetchedAt;
        return disk.payload;
      }
    }
    const payload = await options.client.fetchMeta(datasetId);
    if (!hasCoords(payload)) {
      throw new Error(`El meta de ${datasetId} no trae latitude/longitude`);
    }
    const fetchedAt = Date.now();
    const row = entry(datasetId, current.configId, current.csvBundleHash);
    row.meta = payload;
    row.metaFetchedAt = fetchedAt;
    await writeJson(join(options.cacheDir, "meta", `${datasetId}.json`), {
      configId: current.configId,
      csvBundleHash: current.csvBundleHash,
      csvFingerprint: payload.csvFingerprint,
      fetchedAt,
      payload,
    } satisfies DiskEnvelope<DatasetMeta>);
    return payload;
  }

  async function getTrain(datasetId: string): Promise<GhiHistoric> {
    const current = await ensureManifest();
    const cached = mem.get(datasetId);
    if (
      cached?.configId === current.configId &&
      cached.csvBundleHash === current.csvBundleHash &&
      cached.train &&
      fresh(cached.trainFetchedAt, ttlMs)
    ) {
      return cached.train;
    }
    if (!bypassDisk) {
      const disk = await readJson<DiskEnvelope<GhiSeriesJson>>(
        join(options.cacheDir, "train", `${datasetId}.json`),
      );
      if (
        disk &&
        cacheBundleMatches(disk, current) &&
        hasCoords(disk.payload) &&
        Array.isArray(disk.payload.slots) &&
        fresh(disk.fetchedAt, ttlMs)
      ) {
        const historic = toHistoric(disk.payload);
        const row = entry(datasetId, current.configId, current.csvBundleHash);
        row.train = historic;
        row.trainFetchedAt = disk.fetchedAt;
        if (!row.meta) {
          row.meta = {
            datasetId: historic.datasetId ?? datasetId,
            latitude: historic.latitude,
            longitude: historic.longitude,
          };
          row.metaFetchedAt = disk.fetchedAt;
        }
        return historic;
      }
    }
    const payload = await options.client.fetchTrainSeries(datasetId);
    if (!hasCoords(payload)) {
      throw new Error(`El histórico de ${datasetId} no trae latitude/longitude`);
    }
    const historic = toHistoric(payload);
    const fetchedAt = Date.now();
    const row = entry(datasetId, current.configId, current.csvBundleHash);
    row.train = historic;
    row.trainFetchedAt = fetchedAt;
    row.meta = {
      configId: current.configId,
      datasetId: historic.datasetId ?? datasetId,
      latitude: historic.latitude,
      longitude: historic.longitude,
      csvFingerprint: payload.csvFingerprint,
    };
    row.metaFetchedAt = fetchedAt;
    await writeJson(join(options.cacheDir, "train", `${datasetId}.json`), {
      configId: current.configId,
      csvBundleHash: current.csvBundleHash,
      csvFingerprint: payload.csvFingerprint,
      fetchedAt,
      payload,
    });
    return historic;
  }

  async function listDatasets(): Promise<HistoricDatasetInfo[]> {
    await ensureManifest();
    const listed = await options.client.listDatasets();
    return listed.datasets;
  }

  return { getMeta, getTrain, listDatasets };
}

const moduleDir = dirname(fileURLToPath(import.meta.url));

export const historicStore = createHistoricStore({
  client: createWorkshopClient(),
  cacheDir: join(moduleDir, "..", "..", "cache"),
  ttlMs: HISTORIC_CACHE_TTL_MS,
  refresh: REFRESH_HISTORIC,
});
