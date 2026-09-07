import type { GhiSlot } from "./types";
export namespace ManualForecast {
function utcDoy(date: Date) {
    return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
}

function solveSystem(matrix: number[][], vector: number[]) {
    const n = matrix.length;
    const rows = matrix.map((row, i) => [...row, vector[i]]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) {
                pivot = row;
            }
        }
        [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
        const diag = rows[col][col];
        if (Math.abs(diag) < 1e-12) {
            return null;
        }
        for (let j = col; j <= n; j += 1) {
            rows[col][j] /= diag;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = rows[row][col];
            for (let j = col; j <= n; j += 1) {
                rows[row][j] -= factor * rows[col][j];
            }
        }
    }
    return rows.map((row) => row[n]);
}

function fitByFeatures(rows: { doy: number; ghi: number }[], featureFn: (row: { doy: number }) => number[]) {
    const samples = rows.map((row) => featureFn(row));
    const y = rows.map((row) => row.ghi);
    const n = samples.length;
    const k = samples[0]?.length ?? 0;
    if (n < k || k === 0) {
        return null;
    }
    const ata = Array.from({ length: k }, () => Array(k).fill(0));
    const aty = Array(k).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let a = 0; a < k; a += 1) {
            aty[a] += samples[i][a] * y[i];
            for (let b = 0; b < k; b += 1) {
                ata[a][b] += samples[i][a] * samples[i][b];
            }
        }
    }
    const weights = solveSystem(ata, aty);
    if (!weights) {
        return null;
    }
    return {
        predictFromFeatures(features: number[]) {
            return weights.reduce((sum, weight, i) => sum + weight * features[i], 0);
        },
    };
}

function sineFeatures(doy: number) {
    const angle = (2 * Math.PI * (doy - 1)) / 365.25;
    return [1, Math.sin(angle), Math.cos(angle)];
}

function plusCube(value: number, knot: number) {
    const delta = value - knot;
    return delta > 0 ? delta ** 3 : 0;
}

function polySplineFeatures(xn: number) {
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

function fitHourModel(rows: { doy: number; ghi: number }[], kind: "line" | "sine" | "poly") {
    if (kind === "line") {
        const fitted = fitByFeatures(rows, (row) => [1, row.doy]);
        return fitted ? (doy: number) => fitted.predictFromFeatures([1, doy]) : () => 0;
    }
    if (kind === "sine") {
        const fitted = fitByFeatures(rows, (row) => sineFeatures(row.doy));
        return fitted ? (doy: number) => fitted.predictFromFeatures(sineFeatures(doy)) : () => 0;
    }
    const fitted = fitByFeatures(rows, (row) => polySplineFeatures((row.doy - 1) / 365));
    return fitted
        ? (doy: number) => fitted.predictFromFeatures(polySplineFeatures((doy - 1) / 365))
        : () => 0;
}

let cache: { slots: GhiSlot[]; kind: string; models: Map<number, (doy: number) => number> } | null = null;

function modelsFor(slots: GhiSlot[], kind: "line" | "sine" | "poly") {
    if (cache && cache.slots === slots && cache.kind === kind) {
        return cache.models;
    }
    const rows = slots.map((slot) => ({
        hour: slot.time.getUTCHours(),
        doy: utcDoy(slot.time),
        ghi: slot.ghiWm2,
    }));
    const models = new Map<number, (doy: number) => number>();
    for (let hour = 0; hour < 24; hour += 1) {
        models.set(hour, fitHourModel(rows.filter((row) => row.hour === hour), kind));
    }
    cache = { slots, kind, models };
    return models;
}

export function forecastAt(slots: GhiSlot[], timestamp: Date, kind: "line" | "sine" | "poly"): number {
    const models = modelsFor(slots, kind);
    return Math.max(0, models.get(timestamp.getUTCHours())!(utcDoy(timestamp)));
}
}