import * as tf from "@tensorflow/tfjs";
import { MathHelper } from "../core/mathHelper";
import { ensureTfBackend } from "./tfBackend";
import type { GhiSlot } from "../core/types";

/** sin/cos solar hour, sin/cos DOY, norm lat/lon, time scale (matches Python tf_common). */
export const ENHANCED_FEATURE_COUNT = 7;

export type TfTrainingConfig = {
  maxSamples: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  seed: number;
};

export const defaultEnhancedTfTrainingConfig: TfTrainingConfig = {
  maxSamples: 120_000,
  epochs: 12,
  batchSize: 4096,
  learningRate: 1e-3,
  validationSplit: 0.05,
  seed: 42,
};

function dayOfYearUtc(timestamp: Date): number {
  const start = Date.UTC(timestamp.getUTCFullYear(), 0, 0);
  const day = Date.UTC(
    timestamp.getUTCFullYear(),
    timestamp.getUTCMonth(),
    timestamp.getUTCDate(),
  );
  return Math.floor((day - start) / 86_400_000);
}

export function enhancedFeatureVector(
  timestamp: Date,
  latitude: number,
  longitude: number,
): number[] {
  const hour = MathHelper.solarHour(timestamp, longitude);
  const solarAngle = (2 * Math.PI * hour) / 24;
  const doy = dayOfYearUtc(timestamp);
  const doyAngle = (2 * Math.PI * doy) / 365.25;
  const unixDays = timestamp.getTime() / 86_400_000;
  return [
    Math.sin(solarAngle),
    Math.cos(solarAngle),
    Math.sin(doyAngle),
    Math.cos(doyAngle),
    latitude / 90,
    longitude / 180,
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

export function buildEnhancedTrainingArrays(
  trainingData: GhiSlot[],
  config: Pick<TfTrainingConfig, "maxSamples" | "seed">,
): { xs: number[][]; ys: number[] } {
  if (trainingData.length === 0) {
    return { xs: [], ys: [] };
  }
  const rows = sampleRows(trainingData, config.maxSamples, config.seed);
  const xs = rows.map((slot) =>
    enhancedFeatureVector(slot.time, slot.latitude, slot.longitude),
  );
  const ys = rows.map((slot) => Math.max(0, slot.ghiWm2));
  return { xs, ys };
}

export async function trainEnhancedKerasRegressor(
  model: tf.LayersModel,
  trainingData: GhiSlot[],
  config: TfTrainingConfig = defaultEnhancedTfTrainingConfig,
): Promise<void> {
  await ensureTfBackend();

  const { xs, ys } = buildEnhancedTrainingArrays(trainingData, config);
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

export async function predictEnhancedNonNegative(
  model: tf.LayersModel,
  timestamp: Date,
  latitude: number,
  longitude: number,
): Promise<number> {
  const [value] = await predictEnhancedBatchNonNegative(model, [timestamp], latitude, longitude);
  return value;
}

export async function predictEnhancedBatchNonNegative(
  model: tf.LayersModel,
  timestamps: Date[],
  latitude: number,
  longitude: number,
): Promise<number[]> {
  if (timestamps.length === 0) {
    return [];
  }
  await ensureTfBackend();
  const xs = timestamps.map((t) => enhancedFeatureVector(t, latitude, longitude));
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
