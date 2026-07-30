import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import { queryString } from "../lib/query";
import { toCsv, parseCsv } from "../lib/csv";

export const contractWorkersRouter = Router();

contractWorkersRouter.use(requireAuth);

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  basicSalary: z.number().positive(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  uan: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const importSchema = z.object({ csv: z.string().min(1) });

const CSV_COLUMNS = ["code", "name", "basicSalary", "bankAccount", "ifsc", "pfNo", "esicNo", "uan", "status"];

function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

/** `:id` always matches a single string; the array case only exists in Express's types for repeatable params like `:id+`. */
function idParam(req: Request): string | undefined {
  const id = req.params["id"];
  return typeof id === "string" ? id : undefined;
}

contractWorkersRouter.get("/", async (req, res) => {
  const q = queryString(req.query["q"]);
  const workers = await prisma.contractWorker.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }
      : {},
    orderBy: { code: "asc" },
  });
  res.json(workers);
});

// Registered before "/:id" so "export" isn't captured as an id.
contractWorkersRouter.get("/export", async (_req, res) => {
  const workers = await prisma.contractWorker.findMany({ orderBy: { code: "asc" } });
  const csv = toCsv(
    workers.map((w) => ({
      code: w.code,
      name: w.name,
      basicSalary: w.basicSalary.toString(),
      bankAccount: w.bankAccount,
      ifsc: w.ifsc,
      pfNo: w.pfNo,
      esicNo: w.esicNo,
      uan: w.uan,
      status: w.status,
    })),
    CSV_COLUMNS
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="contract-workers.csv"');
  res.send(csv);
});

// Registered before "/:id" so "import" isn't captured as an id.
contractWorkersRouter.post("/import", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsedBody = importSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Expected JSON body { csv: string }" });
    return;
  }

  const rows = parseCsv(parsedBody.data.csv);
  const results: { row: number; code?: string; error?: string }[] = [];
  let created = 0;

  for (const [i, row] of rows.entries()) {
    const rowNumber = i + 2; // 1 for the header, 1 for 1-indexing
    const parsed = createSchema.safeParse({
      code: row["code"],
      name: row["name"],
      basicSalary: Number(row["basicSalary"]),
      bankAccount: row["bankAccount"] || undefined,
      ifsc: row["ifsc"] || undefined,
      pfNo: row["pfNo"] || undefined,
      esicNo: row["esicNo"] || undefined,
      uan: row["uan"] || undefined,
    });
    if (!parsed.success) {
      results.push({ row: rowNumber, error: parsed.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }
    try {
      const worker = await prisma.contractWorker.create({ data: parsed.data });
      await logAudit({ userId: req.user!.id, action: "IMPORT", entityType: "ContractWorker", entityId: worker.id, changes: parsed.data });
      created++;
      results.push({ row: rowNumber, code: worker.code });
    } catch (err) {
      const message = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" ? "Code already in use" : "Unexpected error";
      results.push({ row: rowNumber, error: message });
    }
  }

  res.json({ created, total: rows.length, results });
});

contractWorkersRouter.get("/:id", async (req, res) => {
  const worker = await prisma.contractWorker.findUnique({ where: { id: idParam(req) } });
  if (!worker) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(worker);
});

contractWorkersRouter.post("/", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const worker = await prisma.contractWorker.create({ data: parsed.data });
    await logAudit({ userId: req.user!.id, action: "CREATE", entityType: "ContractWorker", entityId: worker.id, changes: parsed.data });
    res.status(201).json(worker);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "Code already in use" });
      return;
    }
    throw err;
  }
});

contractWorkersRouter.put("/:id", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const worker = await prisma.contractWorker.update({
      where: { id: idParam(req) },
      data: parsed.data,
    });
    await logAudit({ userId: req.user!.id, action: "UPDATE", entityType: "ContractWorker", entityId: worker.id, changes: parsed.data });
    res.json(worker);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// Soft delete only: ContractWorker rows are referenced by historical
// PayrollLine rows, so a hard delete would either fail the FK constraint
// or silently orphan past payroll runs. Deactivating preserves history.
contractWorkersRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const worker = await prisma.contractWorker.update({
      where: { id: idParam(req) },
      data: { status: "INACTIVE" },
    });
    await logAudit({ userId: req.user!.id, action: "DELETE", entityType: "ContractWorker", entityId: worker.id });
    res.json(worker);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});
