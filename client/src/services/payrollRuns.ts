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

export interface GenerateResult {
  ok: true;
  filename: string;
}

/**
 * Stub for the real ExcelJS/Puppeteer export
 * (server/src/export/{payrollWorkbook,salarySlip}.ts) — not wired up yet.
 * Callers should show a loading state while this resolves and a success
 * toast after, same as the real thing will need.
 */
export async function generateSalarySheet(month: number, year: number, type: PayrollType): Promise<GenerateResult> {
  const ext = type === "CONTRACT" ? "xlsx" : "pdf";
  return delay({ ok: true, filename: `payroll-${type.toLowerCase()}-${year}-${String(month).padStart(2, "0")}.${ext}` }, 1200);
}
