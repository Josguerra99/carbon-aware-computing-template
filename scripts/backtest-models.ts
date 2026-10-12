/**
 * Offline backtest using cache/train/*.json: for each cutoff, train on data before it and
 * score the next 7 days per site with the website formula 100·(1 − Σ|pred−real| / Σreal).
 *
 *   bun scripts/backtest-models.ts [model,...] [cutoffs]
 *   bun scripts/backtest-models.ts clearsky,composer 2024-12-01,2025-03-01
 *   CFG='{"seasonSigmaDays":20}' bun scripts/backtest-models.ts clearsky
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PredictionModel } from "../src/core/predictionModel";
import type { GhiSeriesJson, GhiSlot } from "../src/core/types";
import { HeliosClearSky } from "../src/workshop/heliosClearSky";

const HOUR_MS = 3_600_000;
const PREDICT_DAYS = 7;
const trainDir = join(import.meta.dir, "..", "cache", "train");

async function loadSites(): Promise<GhiSlot[][]> {
  const files = (await readdir(trainDir)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map(async (file) => {
      const env = JSON.parse(await readFile(join(trainDir, file), "utf8")) as {
        payload: GhiSeriesJson;
      };
      const p = env.payload;
      return p.slots.map((s) => ({
        datasetId: p.datasetId ?? file,
        time: new Date(s.time ?? s.start ?? ""),
        ghiWm2: s.ghiWm2,
        latitude: p.latitude,
        longitude: p.longitude,
        cloudCoverPct: s.cloudCoverPct,
        temperatureC: s.temperatureC,
      }));
    }),
  );
}

const factories: Record<string, () => Promise<PredictionModel>> = {
  clearsky: async () => new HeliosClearSky(JSON.parse(process.env.CFG ?? "{}")),
  composer: async () => new (await import("../src/workshop/heliosComposer")).HeliosComposer(),
};

function defaultCutoffs(): string[] {
  const out: string[] = [];
  for (let m = 0; m < 23; m++) {
    const d = new Date(Date.UTC(2024, m, 1 + (m % 2) * 14));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const modelNames = (process.argv[2] ?? "clearsky").split(",");
const cutoffs = process.argv[3] ? process.argv[3].split(",") : defaultCutoffs();
const sites = await loadSites();

for (const name of modelNames) {
  const perCutoff: number[] = [];
  const started = performance.now();
  for (const cutoff of cutoffs) {
    const cutMs = Date.parse(`${cutoff}T00:00:00Z`);
    const endMs = cutMs + PREDICT_DAYS * 24 * HOUR_MS;
    const train = sites.flatMap((rows) => rows.filter((s) => s.time.getTime() < cutMs));
    const model = await factories[name]!();
    await model.train(train);
    const scores: number[] = [];
    for (const rows of sites) {
      const holdout = rows.filter((s) => s.time.getTime() >= cutMs && s.time.getTime() < endMs);
      let sumAbs = 0;
      let sumReal = 0;
      for (const slot of holdout) {
        const pred = Math.max(0, await model.forecast(slot.time, slot.latitude, slot.longitude));
        const real = Math.max(0, slot.ghiWm2);
        sumAbs += Math.abs(pred - real);
        sumReal += real;
      }
      if (sumReal > 0) {
        scores.push(100 * Math.max(0, 1 - sumAbs / sumReal));
      }
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    perCutoff.push(mean);
    console.log(`${name} ${cutoff} mean=${mean.toFixed(2)} (${scores.length} sites)`);
  }
  const overall = perCutoff.reduce((a, b) => a + b, 0) / perCutoff.length;
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`== ${name}: overall ${overall.toFixed(2)} over ${cutoffs.length} cutoffs (${secs}s)`);
}
