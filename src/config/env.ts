export const MAIN_SERVER_URL = (process.env.MAIN_SERVER_URL ?? "http://192.168.0.232:3915").replace(
  /\/$/,
  "",
);

export const PORT = Number(process.env.PORT ?? 3916);

export const TRAIN_DATASETS = (process.env.TRAIN_DATASETS ?? "all").trim();

/** 0 disables TTL; cache still refreshes when configId or csvBundleHash changes. */
export const HISTORIC_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.HISTORIC_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
})();

export const REFRESH_HISTORIC = ["1", "true", "yes"].includes(
  (process.env.REFRESH_HISTORIC ?? "").trim().toLowerCase(),
);
