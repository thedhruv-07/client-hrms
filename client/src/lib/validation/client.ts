import { z } from "zod";

/** Mirrors server/src/routes/clients.ts's createSchema. */
export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  gstNo: z.string().optional(),
  panNo: z.string().optional(),
  hsnSac: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
