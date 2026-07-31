/**
 * Verbatim copy of server/src/engine/bill.ts — keep both in sync.
 *
 * Ports the "Sheet1" client GST bill formulas from the source workbook
 * (PROJECT_SPEC.md section 2) exactly, chained off the wage-register totals
 * (basicWages = Table1 G6, incentiveAmt = Table1 H6).
 */

export interface BillInput {
  /** E10 = Table1!G6 — Basic Earn total from the wage register. */
  basicWages: number;
  /** E11, manual entry. */
  hra?: number;
  /** E12, manual entry. */
  con?: number;
  /**
   * E14 = Table1!H6 — OT total from the wage register. Labeled
   * "INCENTIVE AMT." on the printed bill; kept for continuity with bills
   * already issued rather than relabeled to match what it actually is.
   */
  incentiveAmt: number;
}

export interface BillResult {
  basicWages: number;
  hra: number;
  con: number;
  incentiveAmt: number;
  total1: number;
  esiEmployer: number;
  esiEmployee: number;
  lwf1: number;
  serviceCharge: number;
  lwf2: number;
  total2: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateBill(input: BillInput): BillResult {
  const { basicWages, hra = 0, con = 0, incentiveAmt } = input;

  // E13 is a blank/unlabeled cell in the source sheet, folded into the
  // SUM(E10:E14) range as 0.
  const total1 = basicWages + hra + con + incentiveAmt; // E15
  const esiEmployer = (total1 * 3.25) / 100; // E17 — employer ESI, billed to client
  const esiEmployee = (total1 * 0.75) / 100; // E18 — mirrors the wage-sheet ESIC deduction
  const lwf1 = (total1 * 0.25) / 100; // E19
  const serviceCharge = (total1 * 7) / 100; // E20 — contractor's margin
  const lwf2 = ((basicWages * 0.2) / 100) * 2; // E21 — distinct base (basicWages, not total1) and x2 multiplier, not a duplicate of lwf1

  // E16 is a blank/unlabeled cell, folded into the SUM(E15:E21) range as 0.
  const total2 = total1 + esiEmployer + esiEmployee + lwf1 + serviceCharge + lwf2; // E22
  const cgst = (total2 * 9) / 100; // E23
  const sgst = (total2 * 9) / 100; // E24
  const grandTotal = total2 + cgst + sgst; // E25

  return {
    basicWages: round2(basicWages),
    hra: round2(hra),
    con: round2(con),
    incentiveAmt: round2(incentiveAmt),
    total1: round2(total1),
    esiEmployer: round2(esiEmployer),
    esiEmployee: round2(esiEmployee),
    lwf1: round2(lwf1),
    serviceCharge: round2(serviceCharge),
    lwf2: round2(lwf2),
    total2: round2(total2),
    cgst: round2(cgst),
    sgst: round2(sgst),
    grandTotal: round2(grandTotal),
  };
}
