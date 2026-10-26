/** Exponential backoff with full jitter, capped at 30 minutes. */
export function nextBackoffMs(retryCount: number, random = Math.random): number {
  const capped = Math.min(retryCount, 10);
  const base = Math.min(30 * 60_000, 1_000 * 2 ** capped);
  return Math.floor(random() * base);
}

export function shouldSkipDirtyPull(
  dirtyKeys: ReadonlySet<string>,
  entityType: string,
  entityId: string,
): boolean {
  return dirtyKeys.has(`${entityType}:${entityId}`);
}
