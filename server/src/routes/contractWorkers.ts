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

export const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  clientId: z.string().min(1),
  basicSalary: z.number().positive(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  uan: z.string().optional(),
});

export const updateSchema = createSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const importSchema = z.object({ csv: z.string().min(1) });

const CSV_COLUMNS = ["code", "name", "clientId", "basicSalary", "bankAccount", "ifsc", "pfNo", "esicNo", "uan", "status"];

function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

/** `:id` always matches a single string; the array case only exists in Express's types for repeatable params like `:id+`. */
function idParam(req: Request): string | undefined {
  const id = req.params["id"];
  return typeof id === "string" ? id : undefined;
}

/**
 * @openapi
 * /contract-workers:
 *   get:
 *     tags: [Contract Workers]
 *     summary: List contract workers
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Case-insensitive substring match on name or code
 *       - in: query
 *         name: clientId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of contract workers
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/ContractWorker' } }
 *       401: { description: Missing or invalid token }
 */
contractWorkersRouter.get("/", async (req, res) => {
  const q = queryString(req.query["q"]);
  const clientId = queryString(req.query["clientId"]);
  const workers = await prisma.contractWorker.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { code: "asc" },
  });
  res.json(workers);
});

/**
 * @openapi
 * /contract-workers/export:
 *   get:
 *     tags: [Contract Workers]
 *     summary: Export all contract workers as CSV
 *     responses:
 *       200:
 *         description: CSV file (code,name,basicSalary,bankAccount,ifsc,pfNo,esicNo,uan,status)
 *         content:
 *           text/csv: { schema: { type: string } }
 *       401: { description: Missing or invalid token }
 */
// Registered before "/:id" so "export" isn't captured as an id.
contractWorkersRouter.get("/export", async (_req, res) => {
  const workers = await prisma.contractWorker.findMany({ orderBy: { code: "asc" } });
  const csv = toCsv(
    workers.map((w) => ({
      code: w.code,
      name: w.name,
      clientId: w.clientId,
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

/**
 * @openapi
 * /contract-workers/import:
 *   post:
 *     tags: [Contract Workers]
 *     summary: Bulk-create contract workers from CSV (ADMIN, HR)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csv]
 *             properties:
 *               csv: { type: string, description: "Header row: code,name,basicSalary,bankAccount,ifsc,pfNo,esicNo,uan" }
 *     responses:
 *       200:
 *         description: Per-row results — a row failing validation or a duplicate code doesn't abort the rest of the import
 *         content:
 *           application/json: { schema: { $ref: '#/components/schemas/ImportResult' } }
 *       400: { description: Malformed request body }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 */
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
      clientId: row["clientId"],
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

/**
 * @openapi
 * /contract-workers/{id}:
 *   get:
 *     tags: [Contract Workers]
 *     summary: Get a contract worker by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The contract worker, content: { application/json: { schema: { $ref: '#/components/schemas/ContractWorker' } } } }
 *       401: { description: Missing or invalid token }
 *       404: { description: Not found }
 */
contractWorkersRouter.get("/:id", async (req, res) => {
  const worker = await prisma.contractWorker.findUnique({ where: { id: idParam(req) } });
  if (!worker) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(worker);
});

/**
 * @openapi
 * /contract-workers:
 *   post:
 *     tags: [Contract Workers]
 *     summary: Create a contract worker (ADMIN, HR)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, basicSalary]
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               basicSalary: { type: number, exclusiveMinimum: 0 }
 *               bankAccount: { type: string }
 *               ifsc: { type: string }
 *               pfNo: { type: string }
 *               esicNo: { type: string }
 *               uan: { type: string }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/ContractWorker' } } } }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 *       409: { description: Code already in use }
 */
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      res.status(400).json({ error: "Unknown client" });
      return;
    }
    throw err;
  }
});

/**
 * @openapi
 * /contract-workers/{id}:
 *   put:
 *     tags: [Contract Workers]
 *     summary: Update a contract worker (ADMIN, HR)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: All fields optional — partial update
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               basicSalary: { type: number, exclusiveMinimum: 0 }
 *               bankAccount: { type: string }
 *               ifsc: { type: string }
 *               pfNo: { type: string }
 *               esicNo: { type: string }
 *               uan: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200: { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/ContractWorker' } } } }
 *       400: { description: Validation error }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 *       404: { description: Not found }
 */
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      res.status(400).json({ error: "Unknown client" });
      return;
    }
    throw err;
  }
});

/**
 * @openapi
 * /contract-workers/{id}:
 *   delete:
 *     tags: [Contract Workers]
 *     summary: Deactivate a contract worker (ADMIN)
 *     description: Soft delete — sets status to INACTIVE. Historical PayrollLine rows reference this worker, so it's never hard-deleted.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deactivated, content: { application/json: { schema: { $ref: '#/components/schemas/ContractWorker' } } } }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN }
 *       404: { description: Not found }
 */
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
