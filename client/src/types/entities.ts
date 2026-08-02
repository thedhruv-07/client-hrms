/**
 * Mirrors server/prisma/schema.prisma exactly, so swapping the mock API for
 * the real one is a data-layer change, not a type rewrite.
 *
 * Decimal fields (money, hours, days) are typed `string` — that's how
 * Prisma's Decimal serializes over JSON. Parse with Number() at the point
 * of calculation; never store parsed numbers back on these entity shapes.
 */

export type Role = "ADMIN" | "HR" | "ACCOUNTANT" | "VIEWER";
export type PayrollType = "CONTRACT" | "INHOUSE";
export type PayrollStatus = "DRAFT" | "FINALIZED" | "PAID";
export type WorkerStatus = "ACTIVE" | "INACTIVE";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** The contractor's own letterhead details, used to populate wage-sheet and bill headers. */
export interface Company {
  id: string;
  name: string;
  address: string;
  mobile: string | null;
  gstNo: string | null;
  panNo: string | null;
  pfCode: string | null;
  esiCode: string | null;
  bankName: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  branch: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A billing target for contract labour — a client company invoiced monthly. */
export interface Client {
  id: string;
  name: string;
  address: string;
  gstNo: string | null;
  panNo: string | null;
  hsnSac: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractWorker {
  id: string;
  code: string;
  name: string;
  clientId: string;
  basicSalary: string;
  bankAccount: string | null;
  ifsc: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uan: string | null;
  status: WorkerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InHouseEmployee {
  id: string;
  code: string;
  name: string;
  fatherHusbandName: string | null;
  basicSalary: string;
  department: string;
  designation: string;
  /** Deployment site / client location shown on the payslip, e.g. "OMP India Pvt. Limited". */
  location: string | null;
  joiningDate: string;
  leaveBalance: string;
  paymentMode: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uan: string | null;
  status: WorkerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  type: PayrollType;
  /** Only set for CONTRACT runs — one wage register per client per month. Always null for INHOUSE. */
  clientId: string | null;
  status: PayrollStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mirrors the wage-sheet row exactly. One row type serves both modules —
 * exactly one of contractWorkerId / inHouseEmployeeId is set per row.
 */
export interface PayrollLine {
  id: string;
  payrollRunId: string;
  contractWorkerId: string | null;
  inHouseEmployeeId: string | null;
  workingDays: string;
  otHours: string;
  basicEarn: string;
  otAmount: string;
  grossEarning: string;
  pf: string;
  esic: string;
  lwf: string;
  advance: string;
  /** In-house only. */
  bonus: string;
  /** In-house only. */
  incentive: string;
  totalDeduction: string;
  netPayable: string;
  createdAt: string;
  updatedAt: string;
}

/** A client GST bill for one month of contract labour. */
export interface Bill {
  id: string;
  clientId: string;
  payrollRunId: string;
  billNo: string;
  billDate: string;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the bill-sheet rows. One-to-one with Bill. */
export interface BillLine {
  id: string;
  billId: string;
  basicWages: string;
  hra: string;
  con: string;
  /** Labeled "INCENTIVE AMT." on the printed bill; actually the OT total. */
  incentiveAmt: string;
  total1: string;
  esiEmployer: string;
  esiEmployee: string;
  lwf1: string;
  serviceCharge: string;
  /** Second LWF calc (0.2% of basicWages, x2) — distinct from lwf1, not a duplicate. */
  lwf2: string;
  total2: string;
  cgst: string;
  sgst: string;
  grandTotal: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  createdAt: string;
}
