import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { forecast } from "./main";
import type { ForecastPoint, GhiSeriesJson, GhiSlot } from "./types";

const PORT = Number(process.env.PORT ?? 3916);
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL ?? "http://192.168.0.232:3915";
const DEFAULT_FORECAST_HOURS = 7 * 24;
const HOUR_MS = 3_600_000;
const OFFSET = "-06:00";

const app = new Hono();

app.use("/*", cors());

app.get("/", (c) =>
  c.html("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Hello world</title></head><body><h1>Hello world</h1></body></html>"),
);

function formatGuatemala(date: Date): string {
  const local = new Date(date.getTime() - 6 * HOUR_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00.000${OFFSET}`;
}

function guatemalaFields(date: Date) {
  const local = new Date(date.getTime() - 6 * HOUR_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    gtHour: local.getUTCHours(),
    gtDate: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
  };
}

function toDateSlots(historic: GhiSeriesJson): GhiSlot[] {
  return historic.slots.flatMap((slot) => {
    const time = new Date(slot.time ?? slot.start ?? "");
    if (Number.isNaN(time.getTime())) {
      return [];
    }
    return [{
      time,
      ...guatemalaFields(time),
      ghiWm2: slot.ghiWm2,
      cloudCoverPct: slot.cloudCoverPct,
      temperatureC: slot.temperatureC,
    }];
  });
}

function stampHours(slots: GhiSlot[], points: ForecastPoint[]) {
  const last = slots.at(-1);
  if (!last || Number.isNaN(last.time.getTime())) {
    return [];
  }
  const origin = last.time.getTime() + HOUR_MS;
  return points.map((point, i) => ({
    time: formatGuatemala(new Date(origin + i * HOUR_MS)),
    predWm2: point.predWm2,
  }));
}

function defaultZeroHours(hours: number): ForecastPoint[] {
  return Array.from({ length: hours }, () => ({ predWm2: 0 }));
}

function forecastHoursFromQuery(value: string | undefined): number {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_FORECAST_HOURS;
  }
  return Math.floor(hours);
}

const MAIN = MAIN_SERVER_URL.replace(/\/$/, "");
const DATA_DIR = join(import.meta.dir, "..", "data");
const DATASETS_FILE = join(DATA_DIR, "datasets.json");
const HISTORIC_DIR = join(DATA_DIR, "historic");

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

async function cacheDatasets() {
  const cached = await readJson(DATASETS_FILE);
  if (cached != null) {
    return cached;
  }
  const response = await fetch(`${MAIN}/api/datasets`);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${MAIN}/api/datasets`);
  }
  const payload = await response.json();
  await writeJson(DATASETS_FILE, payload);
  return payload;
}

async function loadHistoric(datasetId: string, holdoutDays: number): Promise<GhiSlot[]> {
  const path = join(HISTORIC_DIR, `${datasetId}-${holdoutDays}.json`);
  const cached = await readJson(path);
  if (cached != null) {
    return toDateSlots(cached as GhiSeriesJson);
  }
  const url = `${MAIN}/api/historic/ghi/${datasetId}?days=${holdoutDays}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${url}`);
  }
  const payload = (await response.json()) as GhiSeriesJson;
  await writeJson(path, payload);
  return toDateSlots(payload);
}

app.get("/forecast/:datasetid", async (c) => {
  const datasetId = c.req.param("datasetid");
  const hours = forecastHoursFromQuery(c.req.query("hours") ?? c.req.query("FORECAST_HOURS"));
  const holdoutDays = Math.max(1, Math.round(hours / 24));
  let slots: GhiSlot[];
  try {
    await cacheDatasets();
    slots = await loadHistoric(datasetId, holdoutDays);
  } catch {
    return c.json({ error: `No se pudo conectar a ${MAIN}` }, 502);
  }
  if (slots.length < 24) {
    return c.json({ datasetId, slots: stampHours(slots, defaultZeroHours(hours)) });
  }
  const predicted = (await forecast(slots, hours)).map((pred) => ({
    predWm2: pred,
  }));
  const outgoing = predicted.length > 0 ? predicted : defaultZeroHours(hours);
  return c.json({ datasetId, slots: stampHours(slots, outgoing) });
});

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: app.fetch,
});

console.log(`Template forecast en http://localhost:${PORT}`);
console.log(`Inicio: http://localhost:${PORT}/`);
console.log(`Ejemplo: http://localhost:${PORT}/forecast/chiquimula`);
console.log(`Histórico: ${MAIN_SERVER_URL}/api/historic/ghi/:datasetid`);
