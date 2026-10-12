import { Hono } from "hono";
import { cors } from "hono/cors";
import { MAIN_SERVER_URL, PORT } from "../config/env";
import { historicStore } from "../core/historicStore";
import { Logger } from "../core/debugLogs";
import { perfLog, perfMs, perfNow } from "../core/perfLog";
import { LoadTrainingData, mapPool } from "../loadData";
import { WorkshopModel } from "../main";
const HOUR_MS = 3_600_000;
const MAX_HOURS = 24 * 100;
const FORECAST_CONCURRENCY = 16;

const app = new Hono();

app.use("/*", cors());

app.get("/", (c) =>
  c.html("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Hello world</title></head><body><h1>Hello world</h1></body></html>"),
);

function parseUtc(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function hourlyUtcRange(start: Date, end: Date): Date[] {
  const first = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    start.getUTCHours(),
    0,
    0,
    0,
  );
  const times: Date[] = [];
  for (let stamp = first; stamp < end.getTime(); stamp += HOUR_MS) {
    times.push(new Date(stamp));
  }
  return times;
}

{
  const t0 = perfNow();
  perfLog("training load start");
  const datasets = await LoadTrainingData.load();
  perfLog(`training load ${perfMs(t0)}ms slots=${datasets.length}`);
  const t1 = perfNow();
  await WorkshopModel.train(datasets);
  perfLog(`model.train ${perfMs(t1)}ms`);
  perfLog(`startup total ${perfMs(t0)}ms`);
}

app.get("/forecast/:datasetid", async (c) => {
  const tRequest = perfNow();
  const datasetId = c.req.param("datasetid");
  const start = parseUtc(c.req.query("start"));
  const end = parseUtc(c.req.query("end"));

  if (!start || !end || end.getTime() <= start.getTime()) {
    return c.json({ error: "start and end are required and end must be after start" }, 400);
  }
  const hours = hourlyUtcRange(start, end);
  if (hours.length > MAX_HOURS) {
    return c.json({ error: "range too long" }, 400);
  }
  let latitude: number;
  let longitude: number;
  const tMeta = perfNow();
  try {
    const place = await historicStore.getMeta(datasetId);
    latitude = place.latitude;
    longitude = place.longitude;
  } catch {
    perfLog(`forecast ${datasetId} meta fail ${perfMs(tMeta)}ms`);
    return c.json({ error: `No se pudo leer el histórico de ${datasetId}` }, 502);
  }
  perfLog(
    `forecast ${datasetId} meta ${perfMs(tMeta)}ms hours=${hours.length} concurrency=${FORECAST_CONCURRENCY}`,
  );
  Logger.AllowDebugLogs = true;
  let slots: { time: string; predWm2: number }[] = [];
  let predictSumMs = 0;
  let predictMaxMs = 0;
  const tPool = perfNow();
  try {
    slots = await mapPool(hours, FORECAST_CONCURRENCY, async (timestamp) => {
      const tOne = perfNow();
      const predWm2 = Number(await WorkshopModel.forecast(timestamp, latitude, longitude)) || 0;
      const oneMs = perfMs(tOne);
      predictSumMs += oneMs;
      if (oneMs > predictMaxMs) {
        predictMaxMs = oneMs;
      }
      return { time: timestamp.toISOString(), predWm2 };
    });
  } finally {
    Logger.AllowDebugLogs = false;
  }
  const poolMs = perfMs(tPool);
  const avgMs = hours.length ? (predictSumMs / hours.length).toFixed(2) : "0";
  perfLog(
    `forecast ${datasetId} predict pool=${poolMs}ms sum=${predictSumMs}ms max=${predictMaxMs}ms avg=${avgMs}ms/h`,
  );
  perfLog(`forecast ${datasetId} total ${perfMs(tRequest)}ms`);
  return c.json({ datasetId, slots });
});

const host = "0.0.0.0";

if (typeof Bun !== "undefined") {
  Bun.serve({ port: PORT, hostname: host, fetch: app.fetch });
} else {
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: PORT, hostname: host });
}

console.log(`Template forecast en http://localhost:${PORT}`);
console.log(`Inicio: http://localhost:${PORT}/`);
console.log(`Ejemplo: http://localhost:${PORT}/forecast/chiquimula?start=2026-08-03T00:00:00.000Z&end=2026-09-02T00:00:00.000Z`);
console.log(`Histórico: ${MAIN_SERVER_URL}/api/historic/ghi/:datasetid`);
