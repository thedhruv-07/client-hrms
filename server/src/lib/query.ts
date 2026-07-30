export function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function queryNumber(value: unknown): number | undefined {
  const s = queryString(value);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}
