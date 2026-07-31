import type { PayrollLine, PayrollRun, PayrollType } from "@/types";
import { payrollRuns, payrollLines, monthOptions } from "./mock/seed";
import { delay } from "./mock/db";

export { monthOptions };

export async function listPayrollRuns(type?: PayrollType): Promise<PayrollRun[]> {
  const filtered = type ? payrollRuns.filter((r) => r.type === type) : payrollRuns;
  return delay([...filtered].sort((a, b) => a.year - b.year || a.month - b.month));
}

export async function getPayrollRun(month: number, year: number, type: PayrollType): Promise<PayrollRun | null> {
  return delay(payrollRuns.find((r) => r.month === month && r.year === year && r.type === type) ?? null);
}

export async function getPayrollLines(runId: string): Promise<PayrollLine[]> {
  return delay(payrollLines.filter((l) => l.payrollRunId === runId));
}
