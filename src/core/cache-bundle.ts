import type { WorkshopManifest } from "./workshopClient";

type CachedBundle = { configId: string; csvBundleHash?: string };

/** True when disk cache matches the remote workshop manifest (config + CSV bundle). */
export function cacheBundleMatches(
  disk: CachedBundle | null | undefined,
  remote: WorkshopManifest,
): boolean {
  if (!disk || disk.configId !== remote.configId) {
    return false;
  }
  if (remote.csvBundleHash != null && disk.csvBundleHash !== remote.csvBundleHash) {
    return false;
  }
  return true;
}

export function manifestCacheStale(
  disk: CachedBundle | null | undefined,
  remote: WorkshopManifest,
): boolean {
  return disk != null && !cacheBundleMatches(disk, remote);
}
