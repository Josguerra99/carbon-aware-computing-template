/**
 * Teaching modes aligned with carbon-aware-computing-website (linear / spline / sin-cos pages).
 *
 * 1 Global — all rows, no solarHour filter.
 * 2 HourTime — 24 models (solarHour 0–23), X = time.getTime().
 * 3 HourDoy — same hour filter, X = dayOfYearUtc (linear/spline); sin/cos uses doy features per hour.
 *
 * Template classes:
 * | Mode | Linear              | Polynomial              | Sine/cos                |
 * | 1    | LinearRegressionGlobal | PolynomialSplineGlobal | SineCosineRegressionGlobal |
 * | 2    | LinearRegression       | PolynomialSpline       | SineCosineRegressionHourTime |
 * | 3    | LinearRegressionHourDoy | PolynomialSplineHourDoy | SineCosineRegressionHourDoy |
 */
export const WorkshopMode = {
  Global: 1,
  HourTime: 2,
  HourDoy: 3,
} as const;

export type WorkshopModeId = (typeof WorkshopMode)[keyof typeof WorkshopMode];
