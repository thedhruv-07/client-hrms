import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import { queryString } from "../lib/query";
import { toCsv, parseCsv } from "../lib/csv";

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

const importSchema = z.object({ csv: z.string().min(1) });

const CSV_COLUMNS = [
  "code",
  "name",
  "basicSalary",
  "department",
  "designation",
  "joiningDate",
  "leaveBalance",
  "bankAccount",
  "ifsc",
  "pfNo",
  "esicNo",
  "uan",
  "status",
];

function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

/** `:id` always matches a single string; the array case only exists in Express's types for repeatable params like `:id+`. */
function idParam(req: Request): string | undefined {
  const id = req.params["id"];
  return typeof id === "string" ? id : undefined;
}

inHouseEmployeesRouter.get("/", async (req, res) => {
  const q = queryString(req.query["q"]);
  const employees = await prisma.inHouseEmployee.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }
      : {},
    orderBy: { code: "asc" },
  });
  res.json(employees);
});

// Registered before "/:id" so "export" isn't captured as an id.
inHouseEmployeesRouter.get("/export", async (_req, res) => {
  const employees = await prisma.inHouseEmployee.findMany({ orderBy: { code: "asc" } });
  const csv = toCsv(
    employees.map((e) => ({
      code: e.code,
      name: e.name,
      basicSalary: e.basicSalary.toString(),
      department: e.department,
      designation: e.designation,
      joiningDate: e.joiningDate.toISOString().slice(0, 10),
      leaveBalance: e.leaveBalance.toString(),
      bankAccount: e.bankAccount,
      ifsc: e.ifsc,
      pfNo: e.pfNo,
      esicNo: e.esicNo,
      uan: e.uan,
      status: e.status,
    })),
    CSV_COLUMNS
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="in-house-employees.csv"');
  res.send(csv);
});

// Registered before "/:id" so "import" isn't captured as an id.
inHouseEmployeesRouter.post("/import", requireRole("ADMIN", "HR"), async (req, res) => {
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
      department: row["department"],
      designation: row["designation"],
      joiningDate: row["joiningDate"],
      leaveBalance: row["leaveBalance"] ? Number(row["leaveBalance"]) : undefined,
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
      const employee = await prisma.inHouseEmployee.create({ data: parsed.data });
      await logAudit({ userId: req.user!.id, action: "IMPORT", entityType: "InHouseEmployee", entityId: employee.id, changes: parsed.data });
      created++;
      results.push({ row: rowNumber, code: employee.code });
    } catch (err) {
      const message = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" ? "Code already in use" : "Unexpected error";
      results.push({ row: rowNumber, error: message });
    }
  }

  res.json({ created, total: rows.length, results });
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
    await logAudit({ userId: req.user!.id, action: "CREATE", entityType: "InHouseEmployee", entityId: employee.id, changes: parsed.data });
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
    await logAudit({ userId: req.user!.id, action: "UPDATE", entityType: "InHouseEmployee", entityId: employee.id, changes: parsed.data });
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
    await logAudit({ userId: req.user!.id, action: "DELETE", entityType: "InHouseEmployee", entityId: employee.id });
    res.json(employee);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});
