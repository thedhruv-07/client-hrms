/**
 * In-house employee payroll calc. Unlike the contract wage-register and
 * bill engines (engine/wage.ts, engine/bill.ts), there is no source
 * workbook to port formulas from — these rates are generic India-payroll
 * defaults, NOT confirmed business policy. Treat every rate below as an
 * assumption to verify before trusting this for a real payroll run:
 *   - PF: 12% of basic salary (EPF Act employee share), no wage-ceiling cap
 *   - ESIC: 0.75% of gross, only when gross <= Rs 21,000/month (statutory
 *     coverage threshold) — mirrors the contract engine's 0.75% rate
 *   - LWF: 0.2% of gross — reuses the contract engine's rate for
 *     consistency; LWF is typically state-fixed rather than per-employer
 *   - Unpaid leave: (basicSalary / 30) per day beyond the employee's leave
 *     balance, deducted from gross before bonus/incentive
 */

export interface InHouseWageInput {
  basicSalary: number;
  /** Days taken beyond the employee's leave balance this month. */
  unpaidLeaveDays?: number;
  bonus?: number;
  incentive?: number;
  advance?: number;
}

export interface InHouseWageResult {
  leaveDeduction: number;
  bonus: number;
  incentive: number;
  grossEarning: number;
  pf: number;
  esic: number;
  lwf: number;
  advance: number;
  totalDeduction: number;
  netPayable: number;
}

const ESIC_GROSS_THRESHOLD = 21000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeRaw(input: InHouseWageInput) {
  const { basicSalary, unpaidLeaveDays = 0, bonus = 0, incentive = 0, advance = 0 } = input;

  const leaveDeduction = (basicSalary / 30) * unpaidLeaveDays;
  const grossEarning = basicSalary - leaveDeduction + bonus + incentive;
  const pf = (basicSalary * 12) / 100;
  const esic = grossEarning <= ESIC_GROSS_THRESHOLD ? (grossEarning * 0.75) / 100 : 0;
  const lwf = (grossEarning * 0.2) / 100;
  const totalDeduction = pf + esic + lwf;
  const netPayable = grossEarning - totalDeduction - advance;

  return { leaveDeduction, bonus, incentive, grossEarning, pf, esic, lwf, advance, totalDeduction, netPayable };
}

export function calculateInHouseWageLine(input: InHouseWageInput): InHouseWageResult {
  const raw = computeRaw(input);
  return {
    leaveDeduction: round2(raw.leaveDeduction),
    bonus: round2(raw.bonus),
    incentive: round2(raw.incentive),
    grossEarning: round2(raw.grossEarning),
    pf: round2(raw.pf),
    esic: round2(raw.esic),
    lwf: round2(raw.lwf),
    advance: round2(raw.advance),
    totalDeduction: round2(raw.totalDeduction),
    netPayable: round2(raw.netPayable),
  };
}

/** Recomputes at full precision and sums before rounding — see engine/wage.ts's sumWageLines for why summing already-rounded rows would drift. */
export function sumInHouseWageLines(lines: InHouseWageInput[]): Pick<InHouseWageResult, "grossEarning" | "totalDeduction" | "netPayable"> {
  const raws = lines.map(computeRaw);
  const sum = (pick: (r: ReturnType<typeof computeRaw>) => number) => round2(raws.reduce((acc, r) => acc + pick(r), 0));
  return {
    grossEarning: sum((r) => r.grossEarning),
    totalDeduction: sum((r) => r.totalDeduction),
    netPayable: sum((r) => r.netPayable),
  };
}
