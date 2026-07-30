import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";

export const backupRouter = Router();

backupRouter.use(requireAuth);

const BACKUP_VERSION = 1;

/**
 * Deliberately excludes User and AuditLog:
 *  - User: restoring credentials/roles has different risk characteristics
 *    (can lock the operator out) than restoring payroll data, and isn't
 *    the reason anyone reaches for "restore".
 *  - AuditLog: it's meant to be an append-only trail. A restore should be
 *    an entry IN the log, not something that can overwrite it.
 * Restoring assumes the same User rows (same ids) already exist in this
 * database, since PayrollRun.createdById is a required FK to User that
 * this snapshot does not carry.
 */
backupRouter.get("/", requireRole("ADMIN"), async (_req, res) => {
  const [companies, clients, contractWorkers, inHouseEmployees, payrollRuns, payrollLines, bills, billLines] = await Promise.all([
    prisma.company.findMany(),
    prisma.client.findMany(),
    prisma.contractWorker.findMany(),
    prisma.inHouseEmployee.findMany(),
    prisma.payrollRun.findMany(),
    prisma.payrollLine.findMany(),
    prisma.bill.findMany(),
    prisma.billLine.findMany(),
  ]);

  const filename = `hrms-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { companies, clients, contractWorkers, inHouseEmployees, payrollRuns, payrollLines, bills, billLines },
  });
});

const restoreSchema = z.object({
  version: z.number(),
  // Requires an explicit, unambiguous opt-in — this wipes every table
  // below and replaces it with the snapshot. Not something a client
  // should be able to trigger by posting an unrelated payload.
  confirm: z.literal(true),
  data: z.object({
    companies: z.array(z.any()),
    clients: z.array(z.any()),
    contractWorkers: z.array(z.any()),
    inHouseEmployees: z.array(z.any()),
    payrollRuns: z.array(z.any()),
    payrollLines: z.array(z.any()),
    bills: z.array(z.any()),
    billLines: z.array(z.any()),
  }),
});

backupRouter.post("/restore", requireRole("ADMIN"), async (req, res) => {
  const parsed = restoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.version !== BACKUP_VERSION) {
    res.status(400).json({ error: `Unsupported backup version ${parsed.data.version}, expected ${BACKUP_VERSION}` });
    return;
  }

  const { data } = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Children before parents, to satisfy FK constraints on delete.
    await tx.billLine.deleteMany();
    await tx.bill.deleteMany();
    await tx.payrollLine.deleteMany();
    await tx.payrollRun.deleteMany();
    await tx.inHouseEmployee.deleteMany();
    await tx.contractWorker.deleteMany();
    await tx.client.deleteMany();
    await tx.company.deleteMany();

    // Parents before children, to satisfy FK constraints on create.
    if (data.companies.length) await tx.company.createMany({ data: data.companies });
    if (data.clients.length) await tx.client.createMany({ data: data.clients });
    if (data.contractWorkers.length) await tx.contractWorker.createMany({ data: data.contractWorkers });
    if (data.inHouseEmployees.length) await tx.inHouseEmployee.createMany({ data: data.inHouseEmployees });
    if (data.payrollRuns.length) await tx.payrollRun.createMany({ data: data.payrollRuns });
    if (data.payrollLines.length) await tx.payrollLine.createMany({ data: data.payrollLines });
    if (data.bills.length) await tx.bill.createMany({ data: data.bills });
    if (data.billLines.length) await tx.billLine.createMany({ data: data.billLines });
  });

  await logAudit({ userId: req.user!.id, action: "RESTORE", entityType: "Database", entityId: "all" });

  res.json({ restored: true });
});
