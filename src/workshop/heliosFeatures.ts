import * as tf from "@tensorflow/tfjs";
import { MathHelper } from "../core/mathHelper";
import { ensureTfBackend } from "./tfBackend";
import type { GhiSlot } from "../core/types";

/** Fractional local solar hour in [0, 24) — no rounding (smoother than one-hot). */
function solarHourContinuous(timestamp: Date, longitude: number): number {
  const utc =
    timestamp.getUTCHours() +
    timestamp.getUTCMinutes() / 60 +
    timestamp.getUTCSeconds() / 3600 +
    timestamp.getUTCMilliseconds() / 3_600_000;
  return ((utc + longitude / 15) % 24 + 24) % 24;
}

/**
 * Cyclical solar + season + place (+ slow drift). Tuned for global multi-site GHI.
 * (You suggested “composerWorkshopDelivery”; this file feeds **HeliosComposer**.)
 */
export const HELIOS_FEATURE_COUNT = 12;

export type HeliosTrainingConfig = {
  maxSamples: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  seed: number;
};

export const defaultHeliosTrainingConfig: HeliosTrainingConfig = {
  maxSamples: 120_000,
  epochs: 18,
  batchSize: 4096,
  learningRate: 8e-4,
  validationSplit: 0.05,
  seed: 42,
};

export function heliosFeatureVector(
  timestamp: Date,
  latitude: number,
  longitude: number,
): number[] {
  const hour = solarHourContinuous(timestamp, longitude);
  const solarAngle = (2 * Math.PI * hour) / 24;
  const doy = MathHelper.dayOfYearUtc(timestamp);
  const doyAngle = (2 * Math.PI * doy) / 365.25;
  const doy2 = doyAngle * 2;
  const lonAngle = (2 * Math.PI * longitude) / 360;
  const unixDays = timestamp.getTime() / 86_400_000;

  return [
    Math.sin(solarAngle),
    Math.cos(solarAngle),
    Math.sin(doyAngle),
    Math.cos(doyAngle),
    Math.sin(doy2),
    Math.cos(doy2),
    latitude / 90,
    longitude / 180,
    Math.abs(latitude) / 90,
    Math.sin(lonAngle),
    Math.cos(lonAngle),
    unixDays / 10_000,
  ];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRows<T>(rows: T[], maxSamples: number, seed: number): T[] {
  if (rows.length <= maxSamples) {
    return rows;
  }
  const rng = mulberry32(seed);
  const indices = rows.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, maxSamples).map((i) => rows[i]!);
}

export function buildHeliosTrainingArrays(
  trainingData: GhiSlot[],
  config: Pick<HeliosTrainingConfig, "maxSamples" | "seed">,
): { xs: number[][]; ys: number[] } {
  if (trainingData.length === 0) {
    return { xs: [], ys: [] };
  }
  const rows = sampleRows(trainingData, config.maxSamples, config.seed);
  const xs = rows.map((slot) => heliosFeatureVector(slot.time, slot.latitude, slot.longitude));
  const ys = rows.map((slot) => Math.max(0, slot.ghiWm2));
  return { xs, ys };
}

export async function trainHeliosModel(
  model: tf.LayersModel,
  trainingData: GhiSlot[],
  config: HeliosTrainingConfig = defaultHeliosTrainingConfig,
): Promise<void> {
  await ensureTfBackend();

  const { xs, ys } = buildHeliosTrainingArrays(trainingData, config);
  if (xs.length === 0) {
    throw new Error("No hay datos de entrenamiento");
  }

  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: "meanSquaredError",
  });

  const xTensor = tf.tensor2d(xs);
  const yTensor = tf.tensor2d(ys, [ys.length, 1]);
  try {
    await model.fit(xTensor, yTensor, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      verbose: 0,
    });
  } finally {
    xTensor.dispose();
    yTensor.dispose();
  }
}

export async function predictHeliosBatch(
  model: tf.LayersModel,
  timestamps: Date[],
  latitude: number,
  longitude: number,
): Promise<number[]> {
  if (timestamps.length === 0) {
    return [];
  }
  await ensureTfBackend();
  const xs = timestamps.map((t) => heliosFeatureVector(t, latitude, longitude));
  const input = tf.tensor2d(xs);
  try {
    const output = model.predict(input) as tf.Tensor;
    try {
      const preds = await output.data();
      return Array.from(preds).map((v) => Math.max(0, v));
    } finally {
      output.dispose();
    }
  } finally {
    input.dispose();
  }
}
