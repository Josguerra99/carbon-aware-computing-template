import { Hono } from "hono";
import { cors } from "hono/cors";
import { WorkshopModel } from "../main";
import { LoadTrainingData } from "../loadData";
import { Logger } from "../core/debugLogs";

const PORT = Number(process.env.PORT ?? 3916);
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL ?? "http://192.168.0.232:3915";
const HOUR_MS = 3_600_000;
const MAX_HOURS = 24 * 100;

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

console.log("Training prediction model...");
const trainingData = await LoadTrainingData.load();
await WorkshopModel.train(trainingData);
console.log("Prediction model trained");

app.get("/forecast/:datasetid", async (c) => {
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
  const slots = [];
  for (const timestamp of hours) {
    try{
      Logger.AllowDebugLogs = true;
    const predWm2 = await WorkshopModel.forecast(timestamp);
    slots.push({
      time: timestamp.toISOString(),
      predWm2: Number(predWm2) || 0,
    });
  }finally{
    Logger.AllowDebugLogs = false;
  }
  }
  return c.json({ datasetId, slots });
});

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: app.fetch,
});

console.log(`Template forecast en http://localhost:${PORT}`);
console.log(`Inicio: http://localhost:${PORT}/`);
console.log(`Ejemplo: http://localhost:${PORT}/forecast/chiquimula?start=2026-08-03T00:00:00.000Z&end=2026-09-02T00:00:00.000Z`);
console.log(`Histórico: ${MAIN_SERVER_URL}/api/historic/ghi/:datasetid`);
