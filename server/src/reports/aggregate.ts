/** Sums a numeric field across items — the one loop every report below needs. */
export function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

/** Buckets items by `keyOf` and sums `pick` within each bucket. */
export function groupSumBy<T>(items: T[], keyOf: (item: T) => string, pick: (item: T) => number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    result[key] = (result[key] ?? 0) + pick(item);
  }
  return result;
}

