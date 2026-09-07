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
  ghiWm2: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;
};

export type ForecastPoint = {
  time: string;
  predWm2: number;
};
