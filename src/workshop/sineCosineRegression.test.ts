import { describe, expect, test } from "bun:test";
import type { GhiSlot } from "../core/types";
import {
  SineCosineRegression,
  SineCosineRegressionHourDoy,
  SineCosineRegressionHourTime,
} from "./sineCosineRegression";

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

describe("SineCosineRegressionHourDoy", () => {
  test("alias SineCosineRegression is the same class", () => {
    expect(SineCosineRegression).toBe(SineCosineRegressionHourDoy);
  });
});

describe("SineCosineRegressionHourTime (mode 2)", () => {
  test("forecast uses timestamp ms for matching solarHour", async () => {
    const model = new SineCosineRegressionHourTime();
    await model.train([
      slot("2020-06-01T18:00:00.000Z", 100, -90),
      slot("2021-06-01T18:00:00.000Z", 200, -90),
      slot("2022-06-01T18:00:00.000Z", 150, -90),
      slot("2020-12-01T18:00:00.000Z", 10, -90),
    ]);
    const y = await model.forecast(new Date("2023-06-01T18:00:00.000Z"), 15, -90);
    expect(Number.isFinite(y)).toBe(true);
  });
});
