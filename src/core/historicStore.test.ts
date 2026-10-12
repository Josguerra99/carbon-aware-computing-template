import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { createHistoricStore } from "./historicStore";
import type { WorkshopClient, WorkshopManifest } from "./workshopClient";
import type { GhiSeriesJson } from "./types";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function manifest(configId: string, csvBundleHash = "abc"): WorkshopManifest {
  return {
    configId,
    configName: configId,
    scenarioCount: 1,
    datasetsHash: configId,
    csvBundleHash,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function train(label: string): GhiSeriesJson {
  return {
    datasetId: "mexico",
    location: "CDMX",
    latitude: 19.43,
    longitude: -99.13,
    unit: "W/m²",
    source: label,
    slots: [{ time: "2026-01-01T06:00:00.000Z", ghiWm2: 10, cloudCoverPct: null, temperatureC: null }],
  };
}

describe("historicStore cache", () => {
  test("refetches train series when configId changes", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "historic-"));
    dirs.push(cacheDir);
    let configId = "level-a";
    let trainFetches = 0;
    const client: WorkshopClient = {
      fetchManifest: async () => manifest(configId),
      fetchMeta: async () => ({ datasetId: "mexico", latitude: 19.43, longitude: -99.13 }),
      fetchTrainSeries: async () => {
        trainFetches += 1;
        return train(configId);
      },
      listDatasets: async () => ({ configId, datasets: [] }),
    };

    const first = createHistoricStore({ client, cacheDir, refresh: false, ttlMs: 0 });
    const loaded = await first.getTrain("mexico");
    expect(loaded.slots).toHaveLength(1);
    expect(trainFetches).toBe(1);

    const cached = createHistoricStore({ client, cacheDir, refresh: false, ttlMs: 0 });
    await cached.getTrain("mexico");
    expect(trainFetches).toBe(1);

    configId = "level-b";
    const next = createHistoricStore({ client, cacheDir, refresh: false, ttlMs: 0 });
    const refreshed = await next.getTrain("mexico");
    expect(trainFetches).toBe(2);
    expect(refreshed.slots[0]?.ghiWm2).toBe(10);
  });

  test("refetches train series when csvBundleHash changes", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "historic-"));
    dirs.push(cacheDir);
    let bundle = "csv-v1";
    let trainFetches = 0;
    const client: WorkshopClient = {
      fetchManifest: async () => manifest("level-1", bundle),
      fetchMeta: async () => ({ datasetId: "mexico", latitude: 19.43, longitude: -99.13 }),
      fetchTrainSeries: async () => {
        trainFetches += 1;
        return train(bundle);
      },
      listDatasets: async () => ({ configId: "level-1", datasets: [] }),
    };

    const first = createHistoricStore({ client, cacheDir, refresh: false, ttlMs: 0 });
    await first.getTrain("mexico");
    expect(trainFetches).toBe(1);

    const cached = createHistoricStore({ client, cacheDir, refresh: false, ttlMs: 0 });
    await cached.getTrain("mexico");
    expect(trainFetches).toBe(1);

    bundle = "csv-v2";
    const next = createHistoricStore({ client, cacheDir, refresh: false, ttlMs: 0 });
    await next.getTrain("mexico");
    expect(trainFetches).toBe(2);
  });
});
