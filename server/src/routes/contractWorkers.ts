import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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

function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

/** `:id` always matches a single string; the array case only exists in Express's types for repeatable params like `:id+`. */
function idParam(req: Request): string | undefined {
  const id = req.params["id"];
  return typeof id === "string" ? id : undefined;
}

contractWorkersRouter.get("/", async (_req, res) => {
  const workers = await prisma.contractWorker.findMany({ orderBy: { code: "asc" } });
  res.json(workers);
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
    res.json(worker);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});
