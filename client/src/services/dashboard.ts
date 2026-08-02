import type { AuditLog, PayrollType } from "@/types";
import { listContractWorkers } from "./contractWorkers";
import { listInHouseEmployees } from "./inHouseEmployees";
import { listPayrollRuns, getPayrollLines } from "./payrollRuns";
import { listBills } from "./bills";
import { listUsers } from "./users";
import { listAuditLogs } from "./auditLogs";
import { monthOptions, monthLabelShort } from "@/lib/date";

export interface DashboardStats {
  totalEmployees: number;
  monthlySalary: number;
  todaysAttendance: { present: number; total: number };
  pendingSalary: number;
  salaryPaid: number;
  billsGenerated: number;
  salarySlipsGenerated: number;
}

async function activeCount(type: PayrollType): Promise<number> {
  if (type === "CONTRACT") return (await listContractWorkers()).filter((w) => w.status === "ACTIVE").length;
  return (await listInHouseEmployees()).filter((e) => e.status === "ACTIVE").length;
}

export async function getDashboardStats(type: PayrollType): Promise<DashboardStats> {
  const [runs, total] = await Promise.all([listPayrollRuns(type), activeCount(type)]);

  // CONTRACT has one run per client per month — "latest" is every run in the most recent month that has any.
  const latest = runs.reduce<{ month: number; year: number } | null>((acc, r) => {
    if (!acc || r.year > acc.year || (r.year === acc.year && r.month > acc.month)) return { month: r.month, year: r.year };
    return acc;
  }, null);
  const latestRuns = latest ? runs.filter((r) => r.month === latest.month && r.year === latest.year) : [];
  const lineSets = await Promise.all(latestRuns.map((r) => getPayrollLines(r.id)));
  const statusByRunId = new Map(latestRuns.map((r) => [r.id, r.status]));
  const latestLines = lineSets.flat();

  const monthlySalary = latestLines.reduce((sum, l) => sum + Number(l.netPayable), 0);
  const pendingSalary = latestLines.filter((l) => statusByRunId.get(l.payrollRunId) !== "PAID").reduce((sum, l) => sum + Number(l.netPayable), 0);
  const salaryPaid = latestLines.filter((l) => statusByRunId.get(l.payrollRunId) === "PAID").reduce((sum, l) => sum + Number(l.netPayable), 0);
  // No daily attendance data model exists yet — approximated as workers with
  // a working-days entry recorded in the latest (in-progress) run(s).
  const present = latestLines.filter((l) => Number(l.workingDays) > 0).length;

  let billsGenerated = 0;
  let salarySlipsGenerated = 0;
  if (type === "CONTRACT") {
    const bills = await listBills();
    billsGenerated = latest ? bills.filter((b) => b.month === latest.month && b.year === latest.year).length : 0;
  } else {
    salarySlipsGenerated = latestLines.length;
  }

  return {
    totalEmployees: total,
    monthlySalary,
    todaysAttendance: { present, total },
    pendingSalary,
    salaryPaid,
    billsGenerated,
    salarySlipsGenerated,
  };
}

export interface TrendPoint {
  label: string;
  total: number;
}

export async function getPayrollTrend(type: PayrollType): Promise<TrendPoint[]> {
  const options = monthOptions(6);
  const runs = await listPayrollRuns(type);
  return Promise.all(
    options.map(async ({ month, year }) => {
      const matching = runs.filter((r) => r.month === month && r.year === year);
      if (matching.length === 0) return { label: monthLabelShort(month, year), total: 0 };
      const lineSets = await Promise.all(matching.map((r) => getPayrollLines(r.id)));
      const total = lineSets.flat().reduce((sum, l) => sum + Number(l.netPayable), 0);
      return { label: monthLabelShort(month, year), total: Math.round(total) };
    })
  );
}

export interface ActivityEntry extends AuditLog {
  userName: string;
}

export async function getRecentActivity(limit = 6): Promise<ActivityEntry[]> {
  const [logs, users] = await Promise.all([listAuditLogs(limit), listUsers()]);
  return logs.map((entry) => ({ ...entry, userName: users.find((u) => u.id === entry.userId)?.name ?? "Unknown" }));
}
