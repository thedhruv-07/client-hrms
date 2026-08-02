import { z } from "zod";

/** Mirrors server/src/routes/contractWorkers.ts's createSchema. Uniqueness of `code` is checked at submit time (see services/contractWorkers.ts), not here — it needs the current worker list. */
export const contractWorkerSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  fatherHusbandName: z.string().optional(),
  category: z.string().optional(),
  designation: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  basicSalary: z.coerce.number().positive("Basic salary must be greater than 0"),
  hra: z.coerce.number().min(0, "HRA can't be negative").optional(),
  ta: z.coerce.number().min(0, "TA can't be negative").optional(),
  medicalAllow: z.coerce.number().min(0, "Medical Allowance can't be negative").optional(),
  cea: z.coerce.number().min(0, "CEA can't be negative").optional(),
  miscAllow: z.coerce.number().min(0, "Misc. Allowance can't be negative").optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  uan: z.string().optional(),
  dob: z.string().optional(),
  doj: z.string().optional(),
  mobile: z.string().optional(),
  aadharNo: z.string().optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
});

export type ContractWorkerFormValues = z.infer<typeof contractWorkerSchema>;
