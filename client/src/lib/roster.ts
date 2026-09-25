import type { ContractWorker } from "@/types";

/** Whether a worker belongs on the roster of month `ym` ("YYYY-MM"): joined by then, and not away between leaving and rejoining. */
export function onRoster(w: Pick<ContractWorker, "doj" | "inactiveFrom" | "rejoinedOn">, ym: string): boolean {
  if (w.doj && w.doj.slice(0, 7) > ym) return false;
  if (!w.inactiveFrom || ym <= w.inactiveFrom.slice(0, 7)) return true;
  return !!w.rejoinedOn && ym >= w.rejoinedOn.slice(0, 7);
}
