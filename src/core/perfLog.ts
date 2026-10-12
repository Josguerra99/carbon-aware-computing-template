const PREFIX = "[perf:team]";

export function perfNow(): number {
  return performance.now();
}

export function perfMs(since: number): number {
  return Math.round(performance.now() - since);
}

export function perfLog(message: string): void {
  console.log(`${PREFIX} ${message}`);
}
