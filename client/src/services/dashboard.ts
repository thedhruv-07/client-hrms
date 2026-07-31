import type { AuditLog, PayrollType } from "@/types";
import { contractWorkers, inHouseEmployees, payrollRuns, payrollLines, bills, auditLogs, users, monthOptions } from "./mock/seed";
import { delay } from "./mock/db";
import { monthLabelShort } from "@/lib/date";

export interface DashboardStats {
  totalEmployees: number;
  monthlySalary: number;
  todaysAttendance: { present: number; total: number };
  pendingSalary: number;
  salaryPaid: number;
  billsGenerated: number;
  salarySlipsGenerated: number;
}

function activeWorkerCount(type: PayrollType): number {
  return type === "CONTRACT"
    ? contractWorkers.filter((w) => w.status === "ACTIVE").length
    : inHouseEmployees.filter((e) => e.status === "ACTIVE").length;
}

export async function getDashboardStats(type: PayrollType): Promise<DashboardStats> {
  const runsForType = payrollRuns.filter((r) => r.type === type).sort((a, b) => b.year - a.year || b.month - a.month);
  const latestRun = runsForType[0];
  const latestLines = latestRun ? payrollLines.filter((l) => l.payrollRunId === latestRun.id) : [];

  const monthlySalary = latestLines.reduce((sum, l) => sum + Number(l.netPayable), 0);
  const pendingSalary = latestRun && latestRun.status !== "PAID" ? monthlySalary : 0;
  const salaryPaid = latestRun && latestRun.status === "PAID" ? monthlySalary : 0;
  const total = activeWorkerCount(type);
  // No daily attendance data model exists yet — approximated as workers with
  // a working-days entry recorded in the latest (in-progress) run.
  const present = latestLines.filter((l) => Number(l.workingDays) > 0).length;

  return delay({
    totalEmployees: total,
    monthlySalary,
    todaysAttendance: { present, total },
    pendingSalary,
    salaryPaid,
    billsGenerated: bills.length,
    salarySlipsGenerated: payrollLines.filter((l) => l.inHouseEmployeeId !== null).length,
  });
}

export interface TrendPoint {
  label: string;
  total: number;
}

export async function getPayrollTrend(type: PayrollType): Promise<TrendPoint[]> {
  const points = monthOptions().map(({ month, year, }) => {
    const run = payrollRuns.find((r) => r.month === month && r.year === year && r.type === type);
    const lines = run ? payrollLines.filter((l) => l.payrollRunId === run.id) : [];
    const total = lines.reduce((sum, l) => sum + Number(l.netPayable), 0);
    return { label: monthLabelShort(month, year), total: Math.round(total) };
  });
  return delay(points);
}

export interface ActivityEntry extends AuditLog {
  userName: string;
}

export async function getRecentActivity(limit = 6): Promise<ActivityEntry[]> {
  const rows = [...auditLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((entry) => ({ ...entry, userName: users.find((u) => u.id === entry.userId)?.name ?? "Unknown" }));
  return delay(rows);
}
