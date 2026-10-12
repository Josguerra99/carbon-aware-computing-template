import { describe, expect, test } from "bun:test";
import { MathHelper } from "../core/mathHelper";
import type { GhiSlot } from "../core/types";
import { LinearRegressionByDoyAndHour, doyHourKey } from "./doyHourSliceModels";

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

describe("doyHourKey", () => {
  test("combines doy and solar hour", () => {
    const t = new Date("2024-01-01T18:00:00.000Z");
    const doy = MathHelper.dayOfYearUtc(t);
    const sh = MathHelper.solarHour(t, -90);
    expect(doyHourKey(doy, sh)).toBe(`${doy}:${sh}`);
  });
});

describe("LinearRegressionByDoyAndHour", () => {
  test("forecasts one (doy, hour) class across years", async () => {
    const model = new LinearRegressionByDoyAndHour();
    const training: GhiSlot[] = [];
    for (let year = 2018; year <= 2022; year += 1) {
      training.push(slot(`${year}-01-01T18:00:00.000Z`, year - 2010));
    }
    await model.train(training);
    const t = new Date("2024-01-01T18:00:00.000Z");
    const doy = MathHelper.dayOfYearUtc(t);
    const sh = MathHelper.solarHour(t, -90);
    expect(model.hasKey(doy, sh)).toBe(true);
    const pred = await model.forecast(t, 15, -90);
    expect(pred).toBeGreaterThan(0);
  });
});
