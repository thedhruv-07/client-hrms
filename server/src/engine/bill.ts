/**
 * Client GST bill formulas, ported from the real "BILL CALCULATION" sheet in
 * Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx: Basic / HRA / OT Amount /
 * Attendance Award / Incentive Amt sum to a Sub Total, three employer
 * reimbursements (ESIC, PF, LWF) plus a Service Charge sum to a Taxable
 * Amount, and CGST/SGST bring it to the Grand Total.
 *
 * Only ESIC rounds up to the nearest whole rupee in the source sheet — PF,
 * Service Charge, CGST, and SGST are plain percentages with no rounding
 * function applied (Excel's "0" number format there is display-only), so
 * they're kept at paisa precision like the rest of this app's money fields.
 */

// ponytail: EPFO's statutory monthly wage ceiling for mandatory employer PF
// contribution. Update here if the ceiling changes; per-worker opt-in above
// the ceiling isn't modeled.
const PF_WAGE_CEILING = 15000;

export interface BillInput {
  /** Each worker's Basic Earn for the month — summed for the Basic line, and separately capped per-worker at the EPF wage ceiling for the PF reimbursement base. */
  workerBasicEarnings: number[];
  /** Each worker's HRA Earn for the month, summed for the HRA line. */
  workerHraEarnings?: number[];
  /** OT total from the wage register (double-rate OT, already summed). */
  otAmount: number;
  /** Attendance Award total from the wage register (sum of each worker's flat award). */
  attendAward?: number;
  /** Incentive Amt total from the wage register (sum of each worker's prorated incentive). */
  incentiveAmt?: number;
  /** 2x the wage register's total employee LWF/Welfare deductions — the employer's LWF reimbursement, already computed and summed by the caller. */
  lwf?: number;
}

export interface BillResult {
  basicWages: number;
  hra: number;
  otAmount: number;
  attendAward: number;
  incentiveAmt: number;
  total1: number;
  esiEmployer: number;
  /** The EPF-wage-ceiling-capped basic that pfEmployer's 13% is computed on. */
  pfBase: number;
  pfEmployer: number;
  lwf: number;
  serviceCharge: number;
  total2: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Only ESIC rounds up to the nearest whole rupee in the source sheet. */
function roundUp0(n: number): number {
  return Math.ceil(n);
}

export function calculateBill(input: BillInput): BillResult {
  const { workerBasicEarnings, workerHraEarnings = [], otAmount, attendAward = 0, incentiveAmt = 0, lwf = 0 } = input;

  const basicWages = round2(workerBasicEarnings.reduce((sum, b) => sum + b, 0));
  const hra = round2(workerHraEarnings.reduce((sum, h) => sum + h, 0));
  const pfBase = round2(workerBasicEarnings.reduce((sum, b) => sum + Math.min(b, PF_WAGE_CEILING), 0));

  const total1 = round2(basicWages + hra + otAmount + attendAward + incentiveAmt); // Sub Total
  const esiEmployer = roundUp0((total1 * 3.25) / 100);
  const pfEmployer = round2((pfBase * 13) / 100);
  const serviceCharge = round2((total1 * 5) / 100);

  const total2 = round2(total1 + esiEmployer + pfEmployer + lwf + serviceCharge); // Taxable Amount
  const cgst = round2((total2 * 9) / 100);
  const sgst = round2((total2 * 9) / 100);
  const grandTotal = round2(total2 + cgst + sgst);

  return {
    basicWages,
    hra,
    otAmount: round2(otAmount),
    attendAward: round2(attendAward),
    incentiveAmt: round2(incentiveAmt),
    total1,
    esiEmployer,
    pfBase,
    pfEmployer,
    lwf: round2(lwf),
    serviceCharge,
    total2,
    cgst,
    sgst,
    grandTotal,
  };
}
