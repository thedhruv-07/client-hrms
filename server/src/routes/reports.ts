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

/**
 * @openapi
 * /reports/wage-register:
 *   get:
 *     tags: [Reports]
 *     summary: Wage register — per contract payroll run, worker-by-worker
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: One entry per matching payroll run, each with its worker rows and totals }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/bill-register:
 *   get:
 *     tags: [Reports]
 *     summary: Bills issued per client per period
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema: { type: string }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: Bill rows (billNo, date, client, Total1/2, CGST/SGST, Grand Total) plus a grand total across the list }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/statutory-contributions:
 *   get:
 *     tags: [Reports]
 *     summary: PF/ESIC/LWF totals, contract vs in-house
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: "{ contract: {pf,esic,lwf,total}, inHouse: {pf,esic,lwf,total} }" }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/contract-workers/{id}/history:
 *   get:
 *     tags: [Reports]
 *     summary: One contract worker's net-pay history across every run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Per-run gross/deduction/advance/net rows plus totals }
 *       400: { description: Invalid id }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/advances:
 *   get:
 *     tags: [Reports]
 *     summary: Advances given this period, contract and in-house
 *     description: No recovery tracking exists yet — this is "advances given," not "still outstanding."
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: Advance rows (month, year, type, worker, amount) plus a total }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/inhouse-payroll-summary:
 *   get:
 *     tags: [Reports]
 *     summary: In-house payroll totals per run
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: One entry per matching run, with employee count and gross/deduction/bonus/incentive/net totals }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/department-cost:
 *   get:
 *     tags: [Reports]
 *     summary: In-house salary cost grouped by department
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: One entry per department with employee count and gross/net totals }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/in-house-employees/{id}/history:
 *   get:
 *     tags: [Reports]
 *     summary: One in-house employee's net-pay history across every run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Per-run gross/bonus/incentive/deduction/net rows plus totals }
 *       400: { description: Invalid id }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/gst-summary:
 *   get:
 *     tags: [Reports]
 *     summary: CGST/SGST collected across bills in a period
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: "{ billCount, taxableValue, cgst, sgst, totalGst }" }
 *       401: { description: Missing or invalid token }
 */
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

/**
 * @openapi
 * /reports/audit-log:
 *   get:
 *     tags: [Reports]
 *     summary: Audit trail — who changed what, when
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *         description: e.g. ContractWorker, InHouseEmployee, Database
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 500 }
 *     responses:
 *       200: { description: AuditLog rows, newest first, with the acting user's name/email }
 *       401: { description: Missing or invalid token }
 */
// 10. Audit Log Report. Populated by lib/audit.ts's logAudit(), called
// from every ContractWorker/InHouseEmployee create/update/delete/import
// and from POST /backup/restore.
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
