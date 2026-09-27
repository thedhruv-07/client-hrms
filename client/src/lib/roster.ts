/** Whether a worker/employee belongs on the roster of month `ym` ("YYYY-MM"): joined by then, and not away between leaving and rejoining. */
export function onRoster(w: { doj: string | null; inactiveFrom: string | null; rejoinedOn: string | null }, ym: string): boolean {
  if (w.doj && w.doj.slice(0, 7) > ym) return false;
  if (!w.inactiveFrom || ym <= w.inactiveFrom.slice(0, 7)) return true;
  return !!w.rejoinedOn && ym >= w.rejoinedOn.slice(0, 7);
}
