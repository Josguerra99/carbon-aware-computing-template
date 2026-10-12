import { describe, expect, test } from "bun:test";
import type { GhiSlot } from "../core/types";
import { HeliosClearSky } from "./heliosClearSky";
import { clearSkyHourMean, cosSolarZenith } from "./solarGeometry";

const LAT = 14.6;
const LON = -90.5;

function slot(ms: number, ghi: number): GhiSlot {
  return {
    datasetId: "test",
    time: new Date(ms),
    ghiWm2: ghi,
    latitude: LAT,
    longitude: LON,
    cloudCoverPct: null,
    temperatureC: null,
  };
}

describe("solarGeometry", () => {
  test("sun is up at local noon and down at local midnight", () => {
    expect(cosSolarZenith(Date.parse("2024-06-01T18:00:00Z"), LAT, LON)).toBeGreaterThan(0.9);
    expect(cosSolarZenith(Date.parse("2024-06-01T06:00:00Z"), LAT, LON)).toBeLessThan(0);
  });

  test("hour mean is zero at night", () => {
    expect(clearSkyHourMean(Date.parse("2024-06-01T07:00:00Z"), LAT, LON)).toBe(0);
  });
});

describe("HeliosClearSky", () => {
  test("reproduces a site that always runs at 70% of clear sky", async () => {
    const rows: GhiSlot[] = [];
    for (let ms = Date.parse("2021-01-01T00:00:00Z"); ms < Date.parse("2024-01-01T00:00:00Z"); ms += 3_600_000) {
      rows.push(slot(ms, 0.7 * clearSkyHourMean(ms, LAT, LON)));
    }
    const model = new HeliosClearSky();
    await model.train(rows);

    const noon = Date.parse("2024-03-10T18:00:00Z");
    const pred = await model.forecast(new Date(noon), LAT, LON);
    expect(pred).toBeCloseTo(0.7 * clearSkyHourMean(noon, LAT, LON), 0);
    expect(await model.forecast(new Date("2024-03-10T06:00:00Z"), LAT, LON)).toBe(0);
  });

  test("unknown coordinates fall back to the nearest trained site", async () => {
    const model = new HeliosClearSky();
    await model.train([slot(Date.parse("2023-06-01T18:00:00Z"), 800)]);
    const pred = await model.forecast(new Date("2024-06-01T18:00:00Z"), LAT + 0.5, LON);
    expect(pred).toBeGreaterThan(0);
  });
});
