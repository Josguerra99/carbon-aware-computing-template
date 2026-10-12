import { PredictionModel } from "../core/predictionModel";
import type { GhiSlot } from "../core/types";
import { clearSkyHourMean } from "./solarGeometry";

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2422;
const YEAR_MS = YEAR_DAYS * DAY_MS;

export type HeliosClearSkyConfig = {
  /** Where each slot's hour starts relative to its label (minutes). ERA5 / Open-Meteo = -60. */
  intervalStartMin: number;
  /** Gaussian width (days) of the seasonal window around the target day-of-year. */
  seasonSigmaDays: number;
  /** Weight of the neighbouring UTC hours (±1 h) when pooling clear-sky ratios. */
  neighbourHourWeight: number;
  /** Per-year multiplicative decay so recent years count more. */
  yearDecay: number;
  /** Days right before the end of training that get extra weight (weather persistence). */
  recentDays: number;
  /** Extra weight for those recent days, fading out over `recentFadeDays` of horizon. */
  recentBoost: number;
  recentFadeDays: number;
  /** Below this clear-sky mean (W/m²) use raw GHI instead of clear-sky ratios. */
  minClearSkyForRatio: number;
  /** Clamp on the clear-sky index of each training sample. */
  maxClearSkyIndex: number;
};

export const defaultHeliosClearSkyConfig: HeliosClearSkyConfig = {
  intervalStartMin: -60,
  seasonSigmaDays: 20,
  neighbourHourWeight: 0.5,
  yearDecay: 0.8,
  recentDays: 1,
  recentBoost: 100,
  recentFadeDays: 1.5,
  minClearSkyForRatio: 25,
  maxClearSkyIndex: 1.6,
};

type HourBucket = {
  ms: Float64Array;
  doy: Float64Array;
  ghi: Float64Array;
  clearSky: Float64Array;
};

type Site = {
  latitude: number;
  longitude: number;
  lastMs: number;
  hours: HourBucket[];
};

function siteKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function fractionalDayOfYear(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  return (ms - Date.UTC(year, 0, 1)) / DAY_MS;
}

function circularDayDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % YEAR_DAYS;
  return Math.min(d, YEAR_DAYS - d);
}

/** Value minimising Σ wᵢ·|vᵢ − x| — the right estimator for an absolute-error score. */
function weightedMedian(values: number[], weights: number[]): number {
  const order = values.map((_, i) => i).sort((a, b) => values[a]! - values[b]!);
  let total = 0;
  for (const w of weights) {
    total += w;
  }
  let acc = 0;
  for (const i of order) {
    acc += weights[i]!;
    if (acc >= total / 2) {
      return values[i]!;
    }
  }
  return values[order[order.length - 1]!] ?? 0;
}

/**
 * **HeliosClearSky** — physics + per-site climatology.
 *
 * 1. Solar geometry gives the clear-sky GHI for the exact hour (sunrise, season, latitude).
 * 2. Each training hour becomes a clear-sky index k = GHI / clear-sky (how cloudy it was).
 * 3. A forecast is clear-sky(t) × weighted median of k from the same site, nearby
 *    days-of-year and hours, weighting recent years and the last days before the forecast.
 */
export class HeliosClearSky extends PredictionModel {
  private readonly config: HeliosClearSkyConfig;
  private sites = new Map<string, Site>();

  constructor(config: Partial<HeliosClearSkyConfig> = {}) {
    super();
    this.config = { ...defaultHeliosClearSkyConfig, ...config };
  }

  async train(trainingData: GhiSlot[]): Promise<void> {
    const grouped = new Map<string, GhiSlot[]>();
    for (const slot of trainingData) {
      const key = siteKey(slot.latitude, slot.longitude);
      let rows = grouped.get(key);
      if (!rows) {
        rows = [];
        grouped.set(key, rows);
      }
      rows.push(slot);
    }

    this.sites.clear();
    for (const [key, rows] of grouped) {
      this.sites.set(key, this.buildSite(rows));
    }
  }

  private buildSite(rows: GhiSlot[]): Site {
    const { latitude, longitude } = rows[0]!;
    const perHour: { ms: number; ghi: number; clearSky: number }[][] = Array.from(
      { length: 24 },
      () => [],
    );
    let lastMs = -Infinity;
    for (const slot of rows) {
      const ms = slot.time.getTime();
      if (!Number.isFinite(slot.ghiWm2)) {
        continue;
      }
      lastMs = Math.max(lastMs, ms);
      perHour[slot.time.getUTCHours()]!.push({
        ms,
        ghi: Math.max(0, slot.ghiWm2),
        clearSky: clearSkyHourMean(ms, latitude, longitude, this.config.intervalStartMin),
      });
    }
    const hours = perHour.map((samples) => ({
      ms: Float64Array.from(samples, (s) => s.ms),
      doy: Float64Array.from(samples, (s) => fractionalDayOfYear(s.ms)),
      ghi: Float64Array.from(samples, (s) => s.ghi),
      clearSky: Float64Array.from(samples, (s) => s.clearSky),
    }));
    return { latitude, longitude, lastMs, hours };
  }

  private findSite(latitude: number, longitude: number): Site | undefined {
    const exact = this.sites.get(siteKey(latitude, longitude));
    if (exact) {
      return exact;
    }
    let best: Site | undefined;
    let bestDistance = Infinity;
    for (const site of this.sites.values()) {
      const d = (site.latitude - latitude) ** 2 + (site.longitude - longitude) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = site;
      }
    }
    return best;
  }

  async forecast(timestamp: Date, latitude: number, longitude: number): Promise<number> {
    if (this.sites.size === 0) {
      throw new Error("Model not trained");
    }
    const site = this.findSite(latitude, longitude)!;
    const cfg = this.config;
    const ms = timestamp.getTime();
    const targetClearSky = clearSkyHourMean(ms, latitude, longitude, cfg.intervalStartMin);
    const useRatio = targetClearSky >= cfg.minClearSkyForRatio;
    const targetDoy = fractionalDayOfYear(ms);
    const hour = timestamp.getUTCHours();
    const horizonDays = Math.max(0, (ms - site.lastMs) / DAY_MS);
    const recentWeight =
      1 + (cfg.recentBoost - 1) * Math.max(0, 1 - horizonDays / Math.max(cfg.recentFadeDays, 1e-9));
    const windowDays = cfg.seasonSigmaDays * 3;

    const values: number[] = [];
    const weights: number[] = [];
    const offsets = useRatio && cfg.neighbourHourWeight > 0 ? [0, -1, 1] : [0];
    for (const offset of offsets) {
      const bucket = site.hours[(hour + offset + 24) % 24]!;
      const hourWeight = offset === 0 ? 1 : cfg.neighbourHourWeight;
      for (let i = 0; i < bucket.ms.length; i++) {
        const dd = circularDayDistance(bucket.doy[i]!, targetDoy);
        if (dd > windowDays) {
          continue;
        }
        let value: number;
        if (useRatio) {
          const cs = bucket.clearSky[i]!;
          if (cs < cfg.minClearSkyForRatio) {
            continue;
          }
          value = Math.min(bucket.ghi[i]! / cs, cfg.maxClearSkyIndex);
        } else {
          value = bucket.ghi[i]!;
        }
        const ageMs = site.lastMs - bucket.ms[i]!;
        let w =
          hourWeight *
          Math.exp(-0.5 * (dd / cfg.seasonSigmaDays) ** 2) *
          cfg.yearDecay ** (ageMs / YEAR_MS);
        if (ageMs < cfg.recentDays * DAY_MS) {
          w *= recentWeight;
        }
        values.push(value);
        weights.push(w);
      }
    }
    if (values.length === 0) {
      return 0;
    }
    const median = weightedMedian(values, weights);
    return Math.max(0, useRatio ? median * targetClearSky : median);
  }
}
