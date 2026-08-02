import { z } from "zod";

/** Mirrors server/src/routes/contractWorkers.ts's createSchema. Uniqueness of `code` is checked at submit time (see services/contractWorkers.ts), not here — it needs the current worker list. */
export const contractWorkerSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  clientId: z.string().min(1, "Client is required"),
  basicSalary: z.coerce.number().positive("Basic salary must be greater than 0"),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  uan: z.string().optional(),
});

export type ContractWorkerFormValues = z.infer<typeof contractWorkerSchema>;
