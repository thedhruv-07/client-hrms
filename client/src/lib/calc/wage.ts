/**
 * Verbatim copy of server/src/engine/wage.ts — keep both in sync. Zero
 * dependencies by design, so it runs identically in the browser for the
 * live payroll-run grid and on the server for real generation.
 *
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

function computeRaw(input: WageInput) {
  const { basicSalary, workingDays, otHours, pf = 0, advance = 0 } = input;

  const basicEarn = (basicSalary / 30) * workingDays; // G
  const otAmount = (basicSalary / 30 / 8) * otHours; // H
  const grossEarning = basicEarn + otAmount; // I = SUM(G:H)
  const esic = (grossEarning * 0.75) / 100; // K
  const lwf = (grossEarning * 0.2) / 100; // L
  const totalDeduction = pf + esic + lwf; // N = SUM(J:L)
  const netPayable = grossEarning - totalDeduction - advance; // O = I-N-M

  return { basicEarn, otAmount, grossEarning, pf, esic, lwf, advance, totalDeduction, netPayable };
}

export function calculateWageLine(input: WageInput): WageResult {
  const raw = computeRaw(input);
  return {
    basicEarn: round2(raw.basicEarn),
    otAmount: round2(raw.otAmount),
    grossEarning: round2(raw.grossEarning),
    pf: round2(raw.pf),
    esic: round2(raw.esic),
    lwf: round2(raw.lwf),
    advance: round2(raw.advance),
    totalDeduction: round2(raw.totalDeduction),
    netPayable: round2(raw.netPayable),
  };
}

/**
 * Row 6 column totals. Recomputes each worker at full precision and sums
 * before rounding — matching Excel's SUM(), which reads the unrounded
 * underlying cell values regardless of 2-decimal display formatting. Summing
 * already-rounded per-worker rows instead would be off by a paisa on real
 * data (verified against the bill engine's known Grand Total fixture).
 */
export function sumWageLines(lines: WageInput[]): Omit<WageResult, "pf" | "esic" | "lwf" | "advance"> {
  const raws = lines.map(computeRaw);
  const sum = (pick: (r: ReturnType<typeof computeRaw>) => number) => round2(raws.reduce((acc, r) => acc + pick(r), 0));
  return {
    basicEarn: sum((r) => r.basicEarn),
    otAmount: sum((r) => r.otAmount),
    grossEarning: sum((r) => r.grossEarning),
    totalDeduction: sum((r) => r.totalDeduction),
    netPayable: sum((r) => r.netPayable),
  };
}
