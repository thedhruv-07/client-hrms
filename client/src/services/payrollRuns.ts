import type { PayrollLine, PayrollRun, PayrollType } from "@/types";
import { monthOptions } from "./mock/seed";
import { api } from "./api";

export { monthOptions };

export async function listPayrollRuns(type?: PayrollType): Promise<PayrollRun[]> {
  return api.get<PayrollRun[]>(`/payroll-runs${type ? `?type=${type}` : ""}`);
}

export async function getPayrollRun(month: number, year: number, type: PayrollType, clientId?: string): Promise<PayrollRun | null> {
  const qs = clientId ? `&clientId=${clientId}` : "";
  const runs = await api.get<PayrollRun[]>(`/payroll-runs?type=${type}&month=${month}&year=${year}${qs}`);
  return runs[0] ?? null;
}

export async function getPayrollLines(runId: string): Promise<PayrollLine[]> {
  return api.get<PayrollLine[]>(`/payroll-runs/${runId}/lines`);
}

export interface SaveContractLineInput {
  contractWorkerId: string;
  actualPresentDays: number;
  weekOffHoliday: number;
  otHours: number;
  advance: number;
  incentiveAllowRate: number;
  attendAward: number;
  nightCount: number;
  nightAllowance: number;
  otArrear: number;
  tds: number;
  otherDeduction: number;
  leaveEncashment: number;
  arrears: number;
  bonus: number;
}

/** Full replace — the server recalculates every line from each worker's current basicSalary. */
export async function saveContractPayrollRun(month: number, year: number, clientId: string, lines: SaveContractLineInput[]): Promise<PayrollRun> {
  return api.put<PayrollRun>("/payroll-runs/contract", { month, year, clientId, lines });
}
