const DEG = Math.PI / 180;
const HOUR_MS = 3_600_000;
const SOLAR_CONSTANT_WM2 = 1361;

/** NOAA fractional year γ (radians) for a UTC instant. */
function fractionalYear(ms: number): number {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const daysInYear = (Date.UTC(year + 1, 0, 1) - start) / 86_400_000;
  const dayFraction = (ms - start) / 86_400_000;
  return (2 * Math.PI * dayFraction) / daysInYear;
}

/** Cosine of the solar zenith angle (NOAA general solar position equations). */
export function cosSolarZenith(ms: number, latitude: number, longitude: number): number {
  const g = fractionalYear(ms);
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const date = new Date(ms);
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarMinutes = utcMinutes + eqTimeMin + 4 * longitude;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG;
  const lat = latitude * DEG;
  return (
    Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)
  );
}

/** Top-of-atmosphere irradiance on a horizontal plane (W/m²). */
export function extraterrestrialHorizontal(ms: number, latitude: number, longitude: number): number {
  const cosZ = cosSolarZenith(ms, latitude, longitude);
  if (cosZ <= 0) {
    return 0;
  }
  const g = fractionalYear(ms);
  const eccentricity =
    1.00011 +
    0.034221 * Math.cos(g) +
    0.00128 * Math.sin(g) +
    0.000719 * Math.cos(2 * g) +
    0.000077 * Math.sin(2 * g);
  return SOLAR_CONSTANT_WM2 * eccentricity * cosZ;
}

/** Haurwitz clear-sky GHI (W/m²) at one instant. */
export function clearSkyGhi(ms: number, latitude: number, longitude: number): number {
  const cosZ = cosSolarZenith(ms, latitude, longitude);
  if (cosZ <= 0.01) {
    return 0;
  }
  return 1098 * cosZ * Math.exp(-0.057 / cosZ);
}

/**
 * Mean clear-sky GHI over the hour that a slot labelled `slotMs` represents.
 * `intervalStartMin` is where that hour starts relative to the label:
 * -60 = preceding hour (Open-Meteo / ERA5 convention), -30 = centred, 0 = following hour.
 */
export function clearSkyHourMean(
  slotMs: number,
  latitude: number,
  longitude: number,
  intervalStartMin = -60,
  subSamples = 12,
): number {
  const start = slotMs + intervalStartMin * 60_000;
  const step = HOUR_MS / subSamples;
  let sum = 0;
  for (let i = 0; i < subSamples; i++) {
    sum += clearSkyGhi(start + (i + 0.5) * step, latitude, longitude);
  }
  return sum / subSamples;
}
