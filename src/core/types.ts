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
  latitude: number;
  longitude: number;
  unit: string;
  source: string;
  slots: GhiSlotJson[];
};

export type HistoricDatasetInfo = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  kind: "department" | "country";
};

export type GhiHistoric = {
  datasetId?: string;
  latitude: number;
  longitude: number;
  slots: GhiSlot[];
};

export type GhiSlot = {
  datasetId: string;
  time: Date;
  ghiWm2: number;
  latitude: number;
  longitude: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;

};


export type ForecastPoint = {
  time: string;
  predWm2: number;
};
