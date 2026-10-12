import { TRAIN_DATASETS } from "../config/env";
import { historicStore } from "./historicStore";
import type { GhiSlot } from "./types";

const TRAIN_CONCURRENCY = 4;

function datasetFilter(): Set<string> | null {
  const raw = TRAIN_DATASETS;
  if (!raw || raw.toLowerCase() === "all" || raw === "*") {
    return null;
  }
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

export async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export namespace LoadTrainingData {
  export async function load(): Promise<GhiSlot[]> {
    const allowed = datasetFilter();
    const datasets = await historicStore.listDatasets();
    const selected = allowed ? datasets.filter((dataset) => allowed.has(dataset.id)) : datasets;
    if (!selected.length) {
      throw new Error("No hay datasets de entrenamiento (revisa TRAIN_DATASETS)");
    }
    const loaded = await mapPool(selected, TRAIN_CONCURRENCY, (dataset) => historicStore.getTrain(dataset.id));
    return loaded.flatMap((dataset) => dataset.slots);
  }
}
