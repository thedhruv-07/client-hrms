import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const inHouseEmployeesRouter = Router();

inHouseEmployeesRouter.use(requireAuth);

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  basicSalary: z.number().positive(),
  department: z.string().min(1),
  designation: z.string().min(1),
  joiningDate: z.coerce.date(),
  leaveBalance: z.number().min(0).optional(),
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

inHouseEmployeesRouter.get("/", async (_req, res) => {
  const employees = await prisma.inHouseEmployee.findMany({ orderBy: { code: "asc" } });
  res.json(employees);
});

inHouseEmployeesRouter.get("/:id", async (req, res) => {
  const employee = await prisma.inHouseEmployee.findUnique({ where: { id: idParam(req) } });
  if (!employee) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(employee);
});

inHouseEmployeesRouter.post("/", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const employee = await prisma.inHouseEmployee.create({ data: parsed.data });
    res.status(201).json(employee);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "Code already in use" });
      return;
    }
    throw err;
  }
});

inHouseEmployeesRouter.put("/:id", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const employee = await prisma.inHouseEmployee.update({
      where: { id: idParam(req) },
      data: parsed.data,
    });
    res.json(employee);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// Soft delete only: InHouseEmployee rows are referenced by historical
// PayrollLine rows, so a hard delete would either fail the FK constraint
// or silently orphan past payroll runs. Deactivating preserves history.
inHouseEmployeesRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const employee = await prisma.inHouseEmployee.update({
      where: { id: idParam(req) },
      data: { status: "INACTIVE" },
    });
    res.json(employee);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});
