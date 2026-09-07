export namespace MathHelper {


    export function createParabola(height: number, start: number, end: number): (x: number) => number {
        const mid = (start + end) / 2;
        const half = (end - start) / 2;
        return (x: number) => height * (1 - Math.pow((x - mid) / half, 2));
    }


    export function linearRegression(x:number,points:{x: number, y: number}[]): number {
        const sumX = points.reduce((a, b) => a + b.x, 0);
        const sumY = points.reduce((a, b) => a + b.y, 0);
        const sumXY = points.reduce((a, b) => a + b.x * b.y, 0);
        const sumXX = points.reduce((a, b) => a + b.x * b.x, 0);
        const slope = (points.length * sumXY - sumX * sumY) / (points.length * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / points.length;
        return intercept + slope * x;
    }
}