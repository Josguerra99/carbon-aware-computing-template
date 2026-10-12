export namespace MathHelper {

    export function dayOfYearUtc(timestamp: Date): number {
        const year = timestamp.getUTCFullYear();
        const start = Date.UTC(year, 0, 0);
        const day = Date.UTC(year, timestamp.getUTCMonth(), timestamp.getUTCDate());
        return Math.floor((day - start) / 86_400_000);
    }

    function solveSystem(matrix: number[][], vector: number[]): number[] | null {
        const n = matrix.length;
        const rows = matrix.map((row, i) => [...row, vector[i]!]);
        for (let col = 0; col < n; col += 1) {
            let pivot = col;
            for (let row = col + 1; row < n; row += 1) {
                if (Math.abs(rows[row]![col]!) > Math.abs(rows[pivot]![col]!)) {
                    pivot = row;
                }
            }
            [rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!];
            const diag = rows[col]![col]!;
            if (Math.abs(diag) < 1e-12) {
                return null;
            }
            for (let j = col; j <= n; j += 1) {
                rows[col]![j]! /= diag;
            }
            for (let row = 0; row < n; row += 1) {
                if (row === col) {
                    continue;
                }
                const factor = rows[row]![col]!;
                for (let j = col; j <= n; j += 1) {
                    rows[row]![j]! -= factor * rows[col]![j]!;
                }
            }
        }
        return rows.map((row) => row[n]!);
    }

    export function fitByFeatures(
        samples: number[][],
        y: number[],
    ): ((features: number[]) => number) | null {
        const n = samples.length;
        const k = samples[0]?.length ?? 0;
        if (n < k || k === 0) {
            return null;
        }
        const ata = Array.from({ length: k }, () => Array(k).fill(0));
        const aty = Array(k).fill(0);
        for (let i = 0; i < n; i += 1) {
            const row = samples[i]!;
            const target = y[i]!;
            for (let a = 0; a < k; a += 1) {
                aty[a] += row[a]! * target;
                for (let b = 0; b < k; b += 1) {
                    ata[a]![b]! += row[a]! * row[b]!;
                }
            }
        }
        const weights = solveSystem(ata, aty);
        if (!weights) {
            return null;
        }
        return (features: number[]) =>
            weights.reduce((sum, weight, i) => sum + weight * features[i]!, 0);
    }

    /** Seasonal Fourier terms for day-of-year (same as linear-regression demo). */
    export function sineFeatures(doy: number): number[] {
        const angle = (2 * Math.PI * (doy - 1)) / 365.25;
        return [1, Math.sin(angle), Math.cos(angle)];
    }

    function plusCube(value: number, knot: number): number {
        const delta = value - knot;
        return delta > 0 ? delta ** 3 : 0;
    }

    /** Cubic + truncated cubic spline basis on x in [0, 1] (linear-regression demo). */
    export function polySplineFeatures(xn: number): number[] {
        return [
            1,
            xn,
            xn * xn,
            xn ** 3,
            plusCube(xn, 0.2),
            plusCube(xn, 0.4),
            plusCube(xn, 0.6),
            plusCube(xn, 0.8),
        ];
    }

    export function sineFeaturesFromTimeMs(tMs: number, tMin: number, tMax: number): number[] {
        const xn = (tMs - tMin) / (tMax - tMin || 1);
        const angle = 2 * Math.PI * xn;
        return [1, Math.sin(angle), Math.cos(angle)];
    }

    export function createSineCosineRegression(
        points: { doy: number; y: number }[],
    ): ((doy: number) => number) | null {
        if (points.length < 3) {
            return null;
        }
        const predict = fitByFeatures(
            points.map((p) => sineFeatures(p.doy)),
            points.map((p) => p.y),
        );
        if (!predict) {
            return null;
        }
        return (doy: number) => predict(sineFeatures(doy));
    }

    /** Sin/cos on normalized UTC ms within the sample span (mode 2: X = t). */
    export function createSineCosineRegressionOnTimeMs(
        points: { x: number; y: number }[],
    ): ((tMs: number) => number) | null {
        if (points.length < 3) {
            return null;
        }
        let tMin = points[0]!.x;
        let tMax = points[0]!.x;
        for (const point of points) {
            tMin = Math.min(tMin, point.x);
            tMax = Math.max(tMax, point.x);
        }
        const featuresAt = (tMs: number) => sineFeaturesFromTimeMs(tMs, tMin, tMax);
        const predict = fitByFeatures(
            points.map((p) => featuresAt(p.x)),
            points.map((p) => p.y),
        );
        if (!predict) {
            return null;
        }
        return (tMs: number) => predict(featuresAt(tMs));
    }

    export function createPolynomialSplineRegression(
        points: { x: number; y: number }[],
    ): ((x: number) => number) | null {
        if (points.length < 8) {
            return null;
        }
        let minX = points[0]!.x;
        let maxX = points[0]!.x;
        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
        }
        const span = maxX - minX || 1;
        const predict = fitByFeatures(
            points.map((p) => polySplineFeatures((p.x - minX) / span)),
            points.map((p) => p.y),
        );
        if (!predict) {
            return null;
        }
        return (x: number) => predict(polySplineFeatures((x - minX) / span));
    }

    export function createParabola(height: number, start: number, end: number): (x: number) => number {
        const mid = (start + end) / 2;
        const half = (end - start) / 2;
        return (x: number) => height * (1 - Math.pow((x - mid) / half, 2));
    }



    export function createLinearRegression(points:{x: number, y: number}[]): (x: number) => number {
        const sumX = points.reduce((a, b) => a + b.x, 0);
        const sumY = points.reduce((a, b) => a + b.y, 0);
        const sumXY = points.reduce((a, b) => a + b.x * b.y, 0);
        const sumXX = points.reduce((a, b) => a + b.x * b.x, 0);
        const slope = (points.length * sumXY - sumX * sumY) / (points.length * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / points.length;
        return (x: number) => intercept + slope * x;
    }

    /** Local solar hour in [0, 24). Earth rotates 15° per hour; longitude is the timezone offset. */
    export function solarHour(timestamp: Date, longitude: number): number {
        const utc =
            timestamp.getUTCHours() +
            timestamp.getUTCMinutes() / 60 +
            timestamp.getUTCSeconds() / 3600;
        return Math.round(((utc + longitude / 15) % 24 + 24) % 24) % 24;
    }
}