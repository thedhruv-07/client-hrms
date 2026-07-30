/**
 * Ports the "Table 1" wage-register formulas from the source workbook
 * (PROJECT_SPEC.md section 2) exactly. Intermediate values are kept at full
 * float precision and only rounded at the point each field is returned —
 * mirrors Excel, where cell display formatting rounds independently of the
 * SUM() formulas that consume the underlying unrounded values.
 */

export interface WageInput {
  basicSalary: number;
  workingDays: number;
  otHours: number;
  /** J: hard-coded per-worker value in the source sheet, not a formula. */
  pf?: number;
  /** M: manual entry, not derived. */
  advance?: number;
}

export interface WageResult {
  basicEarn: number;
  otAmount: number;
  grossEarning: number;
  pf: number;
  esic: number;
  lwf: number;
  advance: number;
  totalDeduction: number;
  netPayable: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateWageLine(input: WageInput): WageResult {
  const { basicSalary, workingDays, otHours, pf = 0, advance = 0 } = input;

  const basicEarn = (basicSalary / 30) * workingDays; // G
  const otAmount = (basicSalary / 30 / 8) * otHours; // H
  const grossEarning = basicEarn + otAmount; // I = SUM(G:H)
  const esic = (grossEarning * 0.75) / 100; // K
  const lwf = (grossEarning * 0.2) / 100; // L
  const totalDeduction = pf + esic + lwf; // N = SUM(J:L)
  const netPayable = grossEarning - totalDeduction - advance; // O = I-N-M

  return {
    basicEarn: round2(basicEarn),
    otAmount: round2(otAmount),
    grossEarning: round2(grossEarning),
    pf: round2(pf),
    esic: round2(esic),
    lwf: round2(lwf),
    advance: round2(advance),
    totalDeduction: round2(totalDeduction),
    netPayable: round2(netPayable),
  };
}

/** Row 6 column totals — plain sum of the already-rounded per-worker rows, matching the sheet's SUM() over displayed cells. */
export function sumWageLines(lines: WageResult[]): Omit<WageResult, "pf" | "esic" | "lwf" | "advance"> {
  const sum = (pick: (l: WageResult) => number) => round2(lines.reduce((acc, l) => acc + pick(l), 0));
  return {
    basicEarn: sum((l) => l.basicEarn),
    otAmount: sum((l) => l.otAmount),
    grossEarning: sum((l) => l.grossEarning),
    totalDeduction: sum((l) => l.totalDeduction),
    netPayable: sum((l) => l.netPayable),
  };
}
