import { describe, expect, test } from "bun:test";
import { MathHelper } from "../core/mathHelper";
import type { GhiSlot } from "../core/types";
import {
  LinearRegressionByDoy,
  PolynomialSplineByDoy,
  SineCosineRegressionByDoy,
  rowsForDoy,
} from "./doySliceModels";

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

describe("rowsForDoy", () => {
  test("filters UTC calendar day", () => {
    const rows = [
      slot("2020-06-01T12:00:00.000Z", 100),
      slot("2024-06-01T12:00:00.000Z", 200),
      slot("2020-07-01T12:00:00.000Z", 50),
    ];
    const doy = MathHelper.dayOfYearUtc(new Date("2020-06-01T12:00:00.000Z"));
    const slice = rowsForDoy(rows, doy);
    expect(slice.length).toBe(2);
    expect(slice.every((r) => r.ghiWm2 >= 100)).toBe(true);
  });
});

describe("LinearRegressionByDoy", () => {
  test("fits rising GHI along time for one doy", async () => {
    const model = new LinearRegressionByDoy();
    const training: GhiSlot[] = [];
    for (let year = 2018; year <= 2022; year += 1) {
      training.push(slot(`${year}-03-15T12:00:00.000Z`, year - 2010));
      training.push(slot(`${year}-03-15T18:00:00.000Z`, year - 2010 + 1));
    }
    await model.train(training);
    const doy = MathHelper.dayOfYearUtc(new Date("2020-03-15T12:00:00.000Z"));
    expect(model.hasDoy(doy)).toBe(true);
    const pred = await model.forecast(new Date("2024-03-15T12:00:00.000Z"), 15, -90);
    expect(pred).toBeGreaterThan(0);
  });
});

describe("PolynomialSplineByDoy", () => {
  test("trains when a doy has enough samples", async () => {
    const model = new PolynomialSplineByDoy();
    const training: GhiSlot[] = [];
    for (let i = 0; i < 10; i += 1) {
      training.push(slot(`2020-01-15T${String(i).padStart(2, "0")}:00:00.000Z`, i * 50));
    }
    await model.train(training);
    const pred = await model.forecast(new Date("2020-01-15T05:00:00.000Z"), 15, -90);
    expect(Number.isFinite(pred)).toBe(true);
  });
});

describe("SineCosineRegressionByDoy", () => {
  test("forecasts on trained doy using solar hour", async () => {
    const model = new SineCosineRegressionByDoy();
    const training: GhiSlot[] = [];
    for (let h = 0; h < 24; h += 1) {
      training.push(slot(`2020-06-01T${String(h).padStart(2, "0")}:00:00.000Z`, h * 10, -90));
      training.push(slot(`2021-06-01T${String(h).padStart(2, "0")}:00:00.000Z`, h * 10 + 5, -90));
    }
    await model.train(training);
    const pred = await model.forecast(new Date("2022-06-01T12:00:00.000Z"), 15, -90);
    expect(pred).toBeGreaterThanOrEqual(0);
  });
});
