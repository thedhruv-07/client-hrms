import { Router, type Request } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { sumBy, groupSumBy } from "../reports/aggregate";
import { queryString, queryNumber } from "../lib/query";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

function num(v: unknown): number {
  return Number(v);
}

/** Optional exact year/month filter, shared by every report keyed off PayrollRun. Deliberately no from/to range: real usage is "this month" or "this year", and a range needs either raw SQL or fetch-then-filter for no real payoff yet. */
function payrollRunFilter(query: Request["query"]): { year?: number; month?: number } {
  const year = queryNumber(query["year"]);
  const month = queryNumber(query["month"]);
  return { ...(year !== undefined ? { year } : {}), ...(month !== undefined ? { month } : {}) };
}

function idParam(req: Request): string | undefined {
  return queryString(req.params["id"]);
}

// 1. Wage Register Report — per contract payroll run, worker-by-worker.
reportsRouter.get("/wage-register", async (req, res) => {
  const runs = await prisma.payrollRun.findMany({
    where: { type: "CONTRACT", ...payrollRunFilter(req.query) },
    include: { lines: { include: { contractWorker: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  const report = runs.map((run) => {
    const workers = run.lines.map((line) => ({
      code: line.contractWorker?.code ?? null,
      name: line.contractWorker?.name ?? null,
      workingDays: num(line.workingDays),
      otHours: num(line.otHours),
      grossEarning: num(line.grossEarning),
      totalDeduction: num(line.totalDeduction),
      netPayable: num(line.netPayable),
    }));
    return {
      month: run.month,
      year: run.year,
      workers,
      totals: {
        grossEarning: sumBy(workers, (w) => w.grossEarning),
        totalDeduction: sumBy(workers, (w) => w.totalDeduction),
        netPayable: sumBy(workers, (w) => w.netPayable),
      },
    };
  });

  res.json(report);
});

// 2. Client Bill Register — bills issued per client per period.
reportsRouter.get("/bill-register", async (req, res) => {
  const clientId = queryString(req.query["clientId"]);
  const filter = payrollRunFilter(req.query);

  const bills = await prisma.bill.findMany({
    where: { ...(clientId ? { clientId } : {}), ...filter },
    include: { client: true, line: true },
    orderBy: [{ year: "asc" }, { month: "asc" }, { billNo: "asc" }],
  });

  const rows = bills.map((b) => ({
    billNo: b.billNo,
    billDate: b.billDate,
    month: b.month,
    year: b.year,
    clientName: b.client.name,
    total1: b.line ? num(b.line.total1) : null,
    total2: b.line ? num(b.line.total2) : null,
    cgst: b.line ? num(b.line.cgst) : null,
    sgst: b.line ? num(b.line.sgst) : null,
    grandTotal: b.line ? num(b.line.grandTotal) : null,
  }));

  res.json({ bills: rows, grandTotal: sumBy(rows, (r) => r.grandTotal ?? 0) });
});

// 3. Statutory Contribution Summary — PF/ESIC/LWF, contract vs in-house.
reportsRouter.get("/statutory-contributions", async (req, res) => {
  const runs = await prisma.payrollRun.findMany({
    where: payrollRunFilter(req.query),
    include: { lines: true },
  });

  const summarize = (type: "CONTRACT" | "INHOUSE") => {
    const lines = runs.filter((r) => r.type === type).flatMap((r) => r.lines);
    const pf = sumBy(lines, (l) => num(l.pf));
    const esic = sumBy(lines, (l) => num(l.esic));
    const lwf = sumBy(lines, (l) => num(l.lwf));
    return { pf, esic, lwf, total: pf + esic + lwf };
  };

  res.json({ contract: summarize("CONTRACT"), inHouse: summarize("INHOUSE") });
});

// 4. Contract Worker Payment History.
reportsRouter.get("/contract-workers/:id/history", async (req, res) => {
  const id = idParam(req);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const lines = await prisma.payrollLine.findMany({
    where: { contractWorkerId: id },
    include: { payrollRun: true },
    orderBy: [{ payrollRun: { year: "asc" } }, { payrollRun: { month: "asc" } }],
  });

  const history = lines.map((l) => ({
    month: l.payrollRun.month,
    year: l.payrollRun.year,
    grossEarning: num(l.grossEarning),
    totalDeduction: num(l.totalDeduction),
    advance: num(l.advance),
    netPayable: num(l.netPayable),
  }));

  res.json({
    history,
    totals: {
      grossEarning: sumBy(history, (h) => h.grossEarning),
      advance: sumBy(history, (h) => h.advance),
      netPayable: sumBy(history, (h) => h.netPayable),
    },
  });
});

// 5. Outstanding Advances — advances given this period, both modules.
// No recovery tracking exists yet, so this is "given," not "still owed."
reportsRouter.get("/advances", async (req, res) => {
  const lines = await prisma.payrollLine.findMany({
    where: { advance: { gt: 0 }, payrollRun: payrollRunFilter(req.query) },
    include: { payrollRun: true, contractWorker: true, inHouseEmployee: true },
    orderBy: [{ payrollRun: { year: "asc" } }, { payrollRun: { month: "asc" } }],
  });

  const rows = lines.map((l) => ({
    month: l.payrollRun.month,
    year: l.payrollRun.year,
    type: l.payrollRun.type,
    workerCode: l.contractWorker?.code ?? l.inHouseEmployee?.code ?? null,
    workerName: l.contractWorker?.name ?? l.inHouseEmployee?.name ?? null,
    advance: num(l.advance),
  }));

  res.json({ advances: rows, total: sumBy(rows, (r) => r.advance) });
});

// 6. In-House Payroll Summary — per run.
reportsRouter.get("/inhouse-payroll-summary", async (req, res) => {
  const runs = await prisma.payrollRun.findMany({
    where: { type: "INHOUSE", ...payrollRunFilter(req.query) },
    include: { lines: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  const report = runs.map((run) => ({
    month: run.month,
    year: run.year,
    employeeCount: run.lines.length,
    totals: {
      grossEarning: sumBy(run.lines, (l) => num(l.grossEarning)),
      totalDeduction: sumBy(run.lines, (l) => num(l.totalDeduction)),
      bonus: sumBy(run.lines, (l) => num(l.bonus)),
      incentive: sumBy(run.lines, (l) => num(l.incentive)),
      netPayable: sumBy(run.lines, (l) => num(l.netPayable)),
    },
  }));

  res.json(report);
});

// 7. Department-wise Salary Cost.
reportsRouter.get("/department-cost", async (req, res) => {
  const lines = await prisma.payrollLine.findMany({
    where: { inHouseEmployeeId: { not: null }, payrollRun: { type: "INHOUSE", ...payrollRunFilter(req.query) } },
    include: { inHouseEmployee: true },
  });

  const rows = lines.map((l) => ({
    department: l.inHouseEmployee?.department ?? "Unknown",
    grossEarning: num(l.grossEarning),
    netPayable: num(l.netPayable),
  }));

  const grossByDept = groupSumBy(rows, (r) => r.department, (r) => r.grossEarning);
  const netByDept = groupSumBy(rows, (r) => r.department, (r) => r.netPayable);
  const countByDept = groupSumBy(rows, (r) => r.department, () => 1);

  const departments = Object.keys(grossByDept).map((department) => ({
    department,
    employeeCount: countByDept[department] ?? 0,
    grossEarning: grossByDept[department] ?? 0,
    netPayable: netByDept[department] ?? 0,
  }));

  res.json(departments);
});

// 8. In-House Employee Payment History.
reportsRouter.get("/in-house-employees/:id/history", async (req, res) => {
  const id = idParam(req);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const lines = await prisma.payrollLine.findMany({
    where: { inHouseEmployeeId: id },
    include: { payrollRun: true },
    orderBy: [{ payrollRun: { year: "asc" } }, { payrollRun: { month: "asc" } }],
  });

  const history = lines.map((l) => ({
    month: l.payrollRun.month,
    year: l.payrollRun.year,
    grossEarning: num(l.grossEarning),
    bonus: num(l.bonus),
    incentive: num(l.incentive),
    totalDeduction: num(l.totalDeduction),
    netPayable: num(l.netPayable),
  }));

  res.json({
    history,
    totals: {
      grossEarning: sumBy(history, (h) => h.grossEarning),
      netPayable: sumBy(history, (h) => h.netPayable),
    },
  });
});

// 9. GST Summary — CGST/SGST collected across bills in a period.
reportsRouter.get("/gst-summary", async (req, res) => {
  const year = queryNumber(req.query["year"]);
  const month = queryNumber(req.query["month"]);

  const bills = await prisma.bill.findMany({
    where: { ...(year !== undefined ? { year } : {}), ...(month !== undefined ? { month } : {}) },
    include: { line: true },
  });

  const cgst = sumBy(bills, (b) => (b.line ? num(b.line.cgst) : 0));
  const sgst = sumBy(bills, (b) => (b.line ? num(b.line.sgst) : 0));
  const taxableValue = sumBy(bills, (b) => (b.line ? num(b.line.total2) : 0));

  res.json({ billCount: bills.length, taxableValue, cgst, sgst, totalGst: cgst + sgst });
});

// 10. Audit Log Report.
// No route writes to AuditLog yet — that lands in the import/export/audit
// phase, so this will return an empty list until then.
reportsRouter.get("/audit-log", async (req, res) => {
  const userId = queryString(req.query["userId"]);
  const entityType = queryString(req.query["entityType"]);
  const limit = Math.min(queryNumber(req.query["limit"]) ?? 100, 500);

  const logs = await prisma.auditLog.findMany({
    where: { ...(userId ? { userId } : {}), ...(entityType ? { entityType } : {}) },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json(logs);
});
