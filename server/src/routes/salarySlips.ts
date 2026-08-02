import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { generateSalarySlipsPdf } from "../export/salarySlip";

export const salarySlipsRouter = Router();

salarySlipsRouter.use(requireAuth);

const lineSchema = z.object({ label: z.string(), amount: z.number() });
const earningLineSchema = z.object({ label: z.string(), rate: z.number(), payable: z.number() });

const attendanceSchema = z.object({
  monthDays: z.number(),
  present: z.number(),
  weekOff: z.number(),
  holiday: z.number(),
  cl: z.number(),
  sl: z.number(),
  lwp: z.number(),
  payableDays: z.number(),
  otHours: z.number(),
});

const slipSchema = z.object({
  companyName: z.string(),
  companyAddress: z.string(),
  companyGstNo: z.string().nullish(),
  monthLabel: z.string(),
  employeeName: z.string(),
  employeeCode: z.string(),
  fatherHusbandName: z.string().nullish(),
  department: z.string().nullish(),
  designation: z.string().nullish(),
  location: z.string().nullish(),
  paymentMode: z.string().nullish(),
  bankAccount: z.string().nullish(),
  ifsc: z.string().nullish(),
  pfNo: z.string().nullish(),
  esicNo: z.string().nullish(),
  uan: z.string().nullish(),
  attendance: attendanceSchema.optional(),
  earnings: z.array(earningLineSchema),
  deductions: z.array(lineSchema),
  grossEarning: z.number(),
  totalDeduction: z.number(),
  netPayable: z.number(),
});

const pdfSchema = z.object({ slips: z.array(slipSchema).min(1), slipsPerPage: z.number().int().min(1).max(6).optional() });

/**
 * @openapi
 * /salary-slips/pdf:
 *   post:
 *     tags: [Salary Slips]
 *     summary: Render one or more salary slips to a single PDF (one page per slip)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slips]
 *             properties:
 *               slips: { type: array, items: { type: object }, minItems: 1 }
 *               slipsPerPage: { type: integer, minimum: 1, maximum: 6, description: "Slips stacked per A4 page — defaults to 1 (full-page). Use e.g. 4 for a compact bulk-print layout." }
 *     responses:
 *       200: { description: PDF file, content: { application/pdf: { schema: { type: string, format: binary } } } }
 *       400: { description: Validation error }
 *       401: { description: Missing or invalid token }
 */
salarySlipsRouter.post("/pdf", async (req, res) => {
  const parsed = pdfSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const pdf = await generateSalarySlipsPdf(parsed.data.slips, { slipsPerPage: parsed.data.slipsPerPage });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="salary-slips.pdf"');
  res.send(pdf);
});
