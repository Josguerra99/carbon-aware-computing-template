import { describe, expect, test } from "bun:test";
import type { GhiSlot } from "../core/types";
import {
  LinearRegression,
  LinearRegressionGlobal,
  LinearRegressionHourDoy,
} from "./linearRegression";

function slot(iso: string, ghi: number, longitude = -90): GhiSlot {
  return {
    datasetId: "test",
    time: new Date(iso),
    ghiWm2: ghi,
    latitude: 15,
    longitude,
    cloudCoverPct: null,
    temperatureC: null,
  };
}

describe("LinearRegressionGlobal (mode 1)", () => {
  test("forecast uses timestamp ms, not solarHour", async () => {
    const model = new LinearRegressionGlobal();
    await model.train([
      slot("2020-01-01T12:00:00.000Z", 0),
      slot("2024-01-01T12:00:00.000Z", 400),
    ]);
    const t = new Date("2022-01-01T12:00:00.000Z");
    const y = await model.forecast(t, 15, -90);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(400);
  });
});

describe("LinearRegressionHourDoy (mode 3)", () => {
  test("uses doy at forecast for the matching solarHour bucket", async () => {
    const model = new LinearRegressionHourDoy();
    const rows = [
      slot("2020-06-01T18:00:00.000Z", 100, -90),
      slot("2021-06-01T18:00:00.000Z", 200, -90),
      slot("2020-12-01T18:00:00.000Z", 10, -90),
      slot("2021-12-01T18:00:00.000Z", 20, -90),
    ];
    await model.train(rows);
    const june = await model.forecast(new Date("2025-06-01T18:00:00.000Z"), 15, -90);
    const dec = await model.forecast(new Date("2025-12-01T18:00:00.000Z"), 15, -90);
    expect(june).toBeGreaterThan(dec);
  });
});

describe("LinearRegression (mode 2)", () => {
  test("picks model by solarHour", async () => {
    const model = new LinearRegression();
    await model.train([
      slot("2020-01-01T10:00:00.000Z", 50, -90),
      slot("2024-01-01T10:00:00.000Z", 150, -90),
    ]);
    const y = await model.forecast(new Date("2022-01-01T10:00:00.000Z"), 15, -90);
    expect(y).toBeGreaterThan(50);
    expect(y).toBeLessThan(150);
  });
});
