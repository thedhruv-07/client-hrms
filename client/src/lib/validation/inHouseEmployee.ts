import { z } from "zod";

/** Mirrors server/src/routes/inHouseEmployees.ts's createSchema. */
export const inHouseEmployeeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  fatherHusbandName: z.string().optional(),
  basicSalary: z.coerce.number().positive("Basic salary must be greater than 0"),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  location: z.string().optional(),
  joiningDate: z.string().min(1, "Joining date is required"),
  leaveBalance: z.coerce.number().min(0, "Leave balance cannot be negative").optional(),
  paymentMode: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  uan: z.string().optional(),
});

export type InHouseEmployeeFormValues = z.infer<typeof inHouseEmployeeSchema>;
