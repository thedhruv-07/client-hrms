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
  email: string | null;
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
  fatherHusbandName: string | null;
  /** "CATOGERY" in the source sheet (verbatim spelling kept for the Excel export's header). */
  category: string | null;
  designation: string | null;
  clientId: string;
  basicSalary: string;
  /** Monthly HRA rate, prorated by attendance same as basicSalary. Defaults to 0. */
  hra: string;
  /** Monthly Travel Allowance rate, prorated same as basicSalary. Defaults to 0. */
  ta: string;
  /** Monthly Medical Allowance rate, prorated same as basicSalary. Defaults to 0. */
  medicalAllow: string;
  /** Monthly Children Education Allowance rate, prorated same as basicSalary. Defaults to 0. */
  cea: string;
  /** Monthly Misc. Allowance rate, prorated same as basicSalary. Defaults to 0. */
  miscAllow: string;
  bankAccount: string | null;
  ifsc: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uan: string | null;
  /** Identity/bank fields from the bulk-import sheet — informational only, never on PayrollLine or the wage-sheet exports. */
  dob: string | null;
  doj: string | null;
  mobile: string | null;
  aadharNo: string | null;
  address: string | null;
  bankName: string | null;
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
  /** Contract only — manual input; workingDays = actualPresentDays + weekOffHoliday. */
  actualPresentDays: string;
  /** Contract only — manual input. */
  weekOffHoliday: string;
  workingDays: string;
  otHours: string;
  basicEarn: string;
  /** Contract only — HRA earned, prorated same as basicEarn. */
  hraEarn: string;
  /** Contract only — TA earned, prorated same as basicEarn. */
  taEarn: string;
  /** Contract only — Medical Allowance earned, prorated same as basicEarn. */
  medicalEarn: string;
  /** Contract only — CEA earned, prorated same as basicEarn. */
  ceaEarn: string;
  /** Contract only — Misc. Allowance earned, prorated same as basicEarn (rounded to the rupee). */
  miscEarn: string;
  otAmount: string;
  /** Contract only — manual monthly rate; incentive is prorated from this the same way basicEarn is from basicSalary. */
  incentiveAllowRate: string;
  /** In-house: manual flat bonus/incentive amount. Contract: prorated from incentiveAllowRate. */
  incentive: string;
  /** Contract only — manual flat amount, not prorated. */
  attendAward: string;
  /** Contract only — informational count, not used in any formula. */
  nightCount: string;
  /** Contract only — manual flat amount, feeds the OT stream's Gross Payable. */
  nightAllowance: string;
  /** Contract only — manual flat amount, prior-period correction feeding the OT stream's Total Gross Payable. */
  otArrear: string;
  grossEarning: string;
  pf: string;
  esic: string;
  /** Contract only — Employer's own ESIC contribution @ 3.25%, informational/compliance. */
  employerEsic: string;
  /** Contract only — ESIC deduction on the OT/night-allowance/incentive/attendance-award stream, separate from `esic`. */
  otEsic: string;
  lwf: string;
  advance: string;
  /** Contract only — manual entry. */
  tds: string;
  /** Contract only — manual entry. */
  otherDeduction: string;
  /** Contract only — manual entry, added to net payable. */
  leaveEncashment: string;
  /** Contract only — manual entry, added to net payable. */
  arrears: string;
  /** In-house: manual flat bonus. Contract: "Bonus & Diwali", also manual. */
  bonus: string;
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
  /** OT total from the wage register. */
  otAmount: string;
  attendAward: string;
  incentiveAmt: string;
  total1: string;
  /** Employer's ESIC reimbursement @ 3.25% of Sub Total. */
  esiEmployer: string;
  /** The EPF-wage-ceiling-capped basic that pfEmployer's 13% is computed on — distinct from Sub Total. */
  pfBase: string;
  pfEmployer: string;
  /** Labour Welfare Fund — flat statutory amount. */
  lwf: string;
  serviceCharge: string;
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
