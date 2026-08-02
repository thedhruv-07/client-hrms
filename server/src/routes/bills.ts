import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import { queryString } from "../lib/query";
import { calculateBill } from "../engine/bill";
import { generateBillPdf } from "../export/billPdf";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? ""} ${year}`;
}

export const billsRouter = Router();

billsRouter.use(requireAuth);

/**
 * @openapi
 * /bills:
 *   get:
 *     tags: [Bills]
 *     summary: List client GST bills, optionally filtered to one client
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bills with client and line detail }
 *       401: { description: Missing or invalid token }
 */
billsRouter.get("/", async (req, res) => {
  const clientId = queryString(req.query["clientId"]);
  const bills = await prisma.bill.findMany({
    where: clientId ? { clientId } : {},
    include: { client: true, line: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  res.json(bills);
});

/**
 * @openapi
 * /bills/{id}:
 *   get:
 *     tags: [Bills]
 *     summary: Get one bill
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bill with client and line detail }
 *       401: { description: Missing or invalid token }
 *       404: { description: Not found }
 */
billsRouter.get("/:id", async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params["id"] },
    include: { client: true, line: true },
  });
  if (!bill) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(bill);
});

/**
 * @openapi
 * /bills/{id}/pdf:
 *   get:
 *     tags: [Bills]
 *     summary: Render a bill as a printable tax-invoice PDF
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: PDF file, content: { application/pdf: { schema: { type: string, format: binary } } } }
 *       401: { description: Missing or invalid token }
 *       404: { description: Bill not found, or has no line items yet }
 */
billsRouter.get("/:id/pdf", async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params["id"] },
    include: { client: true, line: true },
  });
  if (!bill || !bill.line) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const company = (await prisma.company.findFirst()) ?? { name: "", address: "", mobile: null, email: null, gstNo: null, panNo: null, pfCode: null, esiCode: null };

  const pdf = await generateBillPdf({
    companyName: company.name,
    companyAddress: company.address,
    companyMobile: company.mobile,
    companyEmail: company.email,
    companyGstNo: company.gstNo,
    companyPanNo: company.panNo,
    companyPfCode: company.pfCode,
    companyEsiCode: company.esiCode,
    clientName: bill.client.name,
    clientAddress: bill.client.address,
    clientGstNo: bill.client.gstNo,
    clientPanNo: bill.client.panNo,
    clientHsnSac: bill.client.hsnSac,
    billNo: bill.billNo,
    billDate: bill.billDate.toISOString(),
    monthLabel: monthLabel(bill.month, bill.year),
    line: {
      basicWages: Number(bill.line.basicWages),
      hra: Number(bill.line.hra),
      otAmount: Number(bill.line.otAmount),
      attendAward: Number(bill.line.attendAward),
      incentiveAmt: Number(bill.line.incentiveAmt),
      total1: Number(bill.line.total1),
      esiEmployer: Number(bill.line.esiEmployer),
      pfBase: Number(bill.line.pfBase),
      pfEmployer: Number(bill.line.pfEmployer),
      lwf: Number(bill.line.lwf),
      serviceCharge: Number(bill.line.serviceCharge),
      total2: Number(bill.line.total2),
      cgst: Number(bill.line.cgst),
      sgst: Number(bill.line.sgst),
      grandTotal: Number(bill.line.grandTotal),
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="bill-${bill.billNo}.pdf"`);
  res.send(pdf);
});

export const generateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  clientId: z.string().min(1),
});

/**
 * @openapi
 * /bills/generate:
 *   post:
 *     tags: [Bills]
 *     summary: Generate (or regenerate) a client GST bill from a period's current contract wage register (ADMIN, HR, ACCOUNTANT)
 *     description: If a bill already exists for the period, its line is recalculated from the wage register as it stands now and overwritten in place — same bill number, fresh numbers. Otherwise a new bill is created.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [month, year, clientId]
 *             properties:
 *               month: { type: integer, minimum: 1, maximum: 12 }
 *               year: { type: integer }
 *               clientId: { type: string }
 *     responses:
 *       200: { description: Existing bill recalculated and updated }
 *       201: { description: Created bill with client and line detail }
 *       400: { description: Validation error, or the period's wage register is empty }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN, HR, or ACCOUNTANT }
 *       404: { description: No contract payroll run for this client/period }
 */
billsRouter.post("/generate", requireRole("ADMIN", "HR", "ACCOUNTANT"), async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { month, year, clientId } = parsed.data;

  const run = await prisma.payrollRun.findUnique({
    where: { month_year_type_clientId: { month, year, type: "CONTRACT", clientId } },
    include: { lines: true },
  });
  if (!run) {
    res.status(404).json({ error: "No contract payroll run for this client/period yet." });
    return;
  }

  if (run.lines.length === 0) {
    res.status(400).json({ error: "This period's wage register is empty." });
    return;
  }

  const workerBasicEarnings = run.lines.map((l) => Number(l.basicEarn));
  const workerHraEarnings = run.lines.map((l) => Number(l.hraEarn));
  const otAmount = run.lines.reduce((sum, l) => sum + Number(l.otAmount), 0);
  const attendAward = run.lines.reduce((sum, l) => sum + Number(l.attendAward), 0);
  const incentiveAmt = run.lines.reduce((sum, l) => sum + Number(l.incentive), 0);
  // The bill's LWF reimbursement is 2x the wage register's own total employee Welfare deductions.
  const lwf = run.lines.reduce((sum, l) => sum + Number(l.lwf), 0) * 2;
  const result = calculateBill({ workerBasicEarnings, workerHraEarnings, otAmount, attendAward, incentiveAmt, lwf });

  const existing = await prisma.bill.findFirst({ where: { payrollRunId: run.id, clientId } });

  if (existing) {
    const bill = await prisma.bill.update({
      where: { id: existing.id },
      data: { line: { update: { ...result } } },
      include: { client: true, line: true },
    });
    await logAudit({ userId: req.user!.id, action: "REGENERATE", entityType: "Bill", entityId: bill.id, changes: { billNo: bill.billNo, month, year } });
    res.status(200).json(bill);
    return;
  }

  const billCount = await prisma.bill.count();
  const billNo = String(billCount + 1).padStart(3, "0");
  const billDate = new Date();

  const bill = await prisma.bill.create({
    data: {
      clientId,
      payrollRunId: run.id,
      billNo,
      billDate,
      month,
      year,
      line: { create: { ...result } },
    },
    include: { client: true, line: true },
  });

  await logAudit({ userId: req.user!.id, action: "CREATE", entityType: "Bill", entityId: bill.id, changes: { billNo, month, year, clientId } });
  res.status(201).json(bill);
});
