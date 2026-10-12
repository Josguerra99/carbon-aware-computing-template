import { MathHelper } from "../core/mathHelper";
import type { GhiSlot } from "../core/types";

export type SampleXY = { x: number; y: number };

/** Bucket training rows by local solar hour; X comes from `xFromSlot`. */
export function bucketTrainingBySolarHour(
  trainingData: GhiSlot[],
  xFromSlot: (row: GhiSlot) => number,
): Map<number, SampleXY[]> {
  const bySolarHour = new Map<number, SampleXY[]>();
  for (const row of trainingData) {
    const sh = MathHelper.solarHour(row.time, row.longitude);
    let bucket = bySolarHour.get(sh);
    if (!bucket) {
      bucket = [];
      bySolarHour.set(sh, bucket);
    }
    bucket.push({ x: xFromSlot(row), y: row.ghiWm2 });
  }
  return bySolarHour;
}

export const xTimeMs = (row: GhiSlot): number => row.time.getTime();
export const xDoyUtc = (row: GhiSlot): number => MathHelper.dayOfYearUtc(row.time);
