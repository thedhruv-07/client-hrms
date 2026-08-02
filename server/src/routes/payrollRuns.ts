import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import { queryString, queryNumber } from "../lib/query";
import { calculateWageLine } from "../engine/wage";

export const payrollRunsRouter = Router();

payrollRunsRouter.use(requireAuth);

/**
 * @openapi
 * /payroll-runs:
 *   get:
 *     tags: [Payroll Runs]
 *     summary: List payroll runs, optionally filtered
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [CONTRACT, INHOUSE] }
 *       - in: query
 *         name: month
 *         schema: { type: integer }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: clientId
 *         schema: { type: string }
 *         description: CONTRACT runs only — each has one client
 *     responses:
 *       200: { description: Payroll runs }
 *       401: { description: Missing or invalid token }
 */
payrollRunsRouter.get("/", async (req, res) => {
  const type = queryString(req.query["type"]);
  const month = queryNumber(req.query["month"]);
  const year = queryNumber(req.query["year"]);
  const clientId = queryString(req.query["clientId"]);
  const runs = await prisma.payrollRun.findMany({
    where: {
      ...(type ? { type: type as "CONTRACT" | "INHOUSE" } : {}),
      ...(month !== undefined ? { month } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  res.json(runs);
});

/**
 * @openapi
 * /payroll-runs/{id}/lines:
 *   get:
 *     tags: [Payroll Runs]
 *     summary: Get a payroll run's wage-register lines
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Payroll lines }
 *       401: { description: Missing or invalid token }
 */
payrollRunsRouter.get("/:id/lines", async (req, res) => {
  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: req.params["id"] },
    orderBy: { createdAt: "asc" },
  });
  res.json(lines);
});

const saveLineSchema = z.object({
  contractWorkerId: z.string().min(1),
  actualPresentDays: z.number().min(0),
  weekOffHoliday: z.number().min(0).default(0),
  otHours: z.number().min(0).default(0),
  advance: z.number().min(0).default(0),
  incentiveAllowRate: z.number().min(0).default(0),
  attendAward: z.number().min(0).default(0),
  nightCount: z.number().min(0).default(0),
  nightAllowance: z.number().min(0).default(0),
  otArrear: z.number().min(0).default(0),
  tds: z.number().min(0).default(0),
  otherDeduction: z.number().min(0).default(0),
  leaveEncashment: z.number().min(0).default(0),
  arrears: z.number().min(0).default(0),
  bonus: z.number().min(0).default(0),
});

export const saveContractRunSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  clientId: z.string().min(1),
  lines: z.array(saveLineSchema),
});

/**
 * @openapi
 * /payroll-runs/contract:
 *   put:
 *     tags: [Payroll Runs]
 *     summary: Save (create or replace) a month's contract wage register (ADMIN, HR)
 *     description: Full replace — recalculates every line server-side from each worker's basicSalary, never trusting client-submitted totals.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [month, year, clientId, lines]
 *             properties:
 *               month: { type: integer, minimum: 1, maximum: 12 }
 *               year: { type: integer }
 *               clientId: { type: string }
 *               lines:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [contractWorkerId, actualPresentDays]
 *                   properties:
 *                     contractWorkerId: { type: string }
 *                     actualPresentDays: { type: number }
 *                     weekOffHoliday: { type: number }
 *                     otHours: { type: number }
 *                     advance: { type: number }
 *                     incentiveAllowRate: { type: number, description: "Monthly incentive allowance rate; prorated into the earned incentive amount same as basicSalary." }
 *                     attendAward: { type: number, description: "Flat attendance award amount, not prorated." }
 *                     nightCount: { type: number, description: "Informational only, not used in any formula." }
 *                     nightAllowance: { type: number, description: "Flat amount, feeds the OT stream's Gross Payable." }
 *                     otArrear: { type: number, description: "Flat amount, prior-period correction feeding the OT stream's Total Gross Payable." }
 *                     tds: { type: number }
 *                     otherDeduction: { type: number }
 *                     leaveEncashment: { type: number }
 *                     arrears: { type: number }
 *                     bonus: { type: number }
 *     responses:
 *       200: { description: The saved payroll run }
 *       400: { description: Validation error, an unknown worker id, or a worker that belongs to a different client }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 *       409: { description: The run is finalized and can no longer be edited }
 */
payrollRunsRouter.put("/contract", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = saveContractRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { month, year, clientId, lines } = parsed.data;

  const existingRun = await prisma.payrollRun.findUnique({ where: { month_year_type_clientId: { month, year, type: "CONTRACT", clientId } } });
  if (existingRun?.status === "FINALIZED") {
    res.status(409).json({ error: "This period is finalized and can no longer be edited." });
    return;
  }

  const workers = await prisma.contractWorker.findMany({ where: { id: { in: lines.map((l) => l.contractWorkerId) } } });
  const workerMap = new Map(workers.map((w) => [w.id, w]));
  for (const l of lines) {
    const worker = workerMap.get(l.contractWorkerId);
    if (!worker) {
      res.status(400).json({ error: `Unknown worker: ${l.contractWorkerId}` });
      return;
    }
    if (worker.clientId !== clientId) {
      res.status(400).json({ error: `Worker ${worker.code} does not belong to this client` });
      return;
    }
  }

  const run = await prisma.payrollRun.upsert({
    where: { month_year_type_clientId: { month, year, type: "CONTRACT", clientId } },
    update: {},
    create: { month, year, type: "CONTRACT", clientId, status: "DRAFT", createdById: req.user!.id },
  });

  const monthDays = new Date(year, month, 0).getDate();
  const lineData = lines.map((l) => {
    const worker = workerMap.get(l.contractWorkerId)!;
    const result = calculateWageLine({
      basicSalary: Number(worker.basicSalary),
      hra: Number(worker.hra),
      ta: Number(worker.ta),
      medicalAllow: Number(worker.medicalAllow),
      cea: Number(worker.cea),
      miscAllow: Number(worker.miscAllow),
      monthDays,
      actualPresentDays: l.actualPresentDays,
      weekOffHoliday: l.weekOffHoliday,
      otHours: l.otHours,
      advance: l.advance,
      incentiveAllowRate: l.incentiveAllowRate,
      attendAward: l.attendAward,
      nightAllowance: l.nightAllowance,
      otArrear: l.otArrear,
      tds: l.tds,
      otherDeduction: l.otherDeduction,
      leaveEncashment: l.leaveEncashment,
      arrears: l.arrears,
      bonus: l.bonus,
    });
    // grossWagesErnd is a derived intermediate (Basic+HRA+allowances earned, used by the bill
    // route), not a PayrollLine column — must be excluded from the create payload.
    const { grossWagesErnd: _grossWagesErnd, ...lineFields } = result;
    return {
      payrollRunId: run.id,
      contractWorkerId: l.contractWorkerId,
      actualPresentDays: l.actualPresentDays,
      weekOffHoliday: l.weekOffHoliday,
      otHours: l.otHours,
      incentiveAllowRate: l.incentiveAllowRate,
      nightCount: l.nightCount,
      ...lineFields,
    };
  });

  await prisma.$transaction([
    prisma.payrollLine.deleteMany({ where: { payrollRunId: run.id } }),
    ...(lineData.length > 0 ? [prisma.payrollLine.createMany({ data: lineData })] : []),
  ]);

  await logAudit({ userId: req.user!.id, action: "SAVE", entityType: "PayrollRun", entityId: run.id, changes: { month, year, workerCount: lines.length } });
  res.json(run);
});
