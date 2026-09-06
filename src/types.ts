export type GhiSlotJson = {
  time?: string;
  start?: string;
  ghiWm2: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;
};

export type GhiSeriesJson = {
  datasetId?: string;
  location: string;
  unit: string;
  source: string;
  slots: GhiSlotJson[];
};

export type GhiSlot = {
  time: Date;
  /** 0–23 in America/Guatemala. */
  gtHour: number;
  /** Calendar day in America/Guatemala, `YYYY-MM-DD`. */
  gtDate: string;
  ghiWm2: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;
};

/** Next hours in order, starting after the last historic slot. */
export type ForecastPoint = {
  predWm2: number;
};
