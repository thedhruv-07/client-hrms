import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";

export const companyRouter = Router();

companyRouter.use(requireAuth);

export const updateSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  mobile: z.string().optional(),
  gstNo: z.string().optional(),
  panNo: z.string().optional(),
  pfCode: z.string().optional(),
  esiCode: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  branch: z.string().optional(),
});

/** Single-row table: the contractor's own letterhead, used across every wage register/bill/payslip export. */
async function getOrCreateCompany() {
  const existing = await prisma.company.findFirst();
  if (existing) return existing;
  return prisma.company.create({ data: { name: "", address: "" } });
}

/**
 * @openapi
 * /company:
 *   get:
 *     tags: [Company]
 *     summary: Get the contractor's own company profile
 *     responses:
 *       200: { description: The company profile }
 *       401: { description: Missing or invalid token }
 */
companyRouter.get("/", async (_req, res) => {
  res.json(await getOrCreateCompany());
});

/**
 * @openapi
 * /company:
 *   put:
 *     tags: [Company]
 *     summary: Update the contractor's own company profile (ADMIN, HR)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               mobile: { type: string }
 *               gstNo: { type: string }
 *               panNo: { type: string }
 *               pfCode: { type: string }
 *               esiCode: { type: string }
 *               bankName: { type: string }
 *               bankAccount: { type: string }
 *               ifsc: { type: string }
 *               branch: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 */
companyRouter.put("/", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await getOrCreateCompany();
  const company = await prisma.company.update({ where: { id: existing.id }, data: parsed.data });
  await logAudit({ userId: req.user!.id, action: "UPDATE", entityType: "Company", entityId: company.id, changes: parsed.data });
  res.json(company);
});
