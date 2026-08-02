/**
 * Ports the real "SALARY SHEET" + "OT Calculation" formulas from
 * Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx column-for-column — the
 * contractor's actual live payroll source.
 *
 * Two independent pay streams per worker, matching the two source sheets:
 *  - Regular wages (Basic/HRA/TA/Medical/CEA/Misc, all prorated by
 *    attendance) — its own ESIC/PF/Welfare employee deductions, plus
 *    TDS/Other Deduction (deductions) and Leave Encashment/Arrears/Bonus
 *    (additions).
 *  - OT/Night Allowance/Attendance Award/Incentive/Overtime Arrear — its
 *    own ESIC deduction, no PF/Welfare.
 * `netPayable`/`grossEarning` combine both streams into one figure for this
 * app's single wage-register row; the Excel export presents them as the
 * two separate sheets the source document uses.
 *
 * One deliberate deviation from the source, carried over from before: the
 * per-day/per-hour rate divides by the period's actual calendar days
 * (30/31/28/29), not the source's hard-coded 30.
 */

// ponytail: EPFO's statutory monthly wage ceiling for mandatory employee PF
// contribution, and the Haryana LWF slab threshold — update here if either
// changes.
const PF_WAGE_CEILING = 15000;
const LWF_GROSS_THRESHOLD = 17500;
const LWF_FLAT_ABOVE_THRESHOLD = 35;

export interface WageInput {
  basicSalary: number;
  /** Monthly HRA rate, prorated same as basicSalary. Defaults to 0. */
  hra?: number;
  /** Monthly Travel Allowance rate, prorated same as basicSalary. Defaults to 0. */
  ta?: number;
  /** Monthly Medical Allowance rate, prorated same as basicSalary. Defaults to 0. */
  medicalAllow?: number;
  /** Monthly Children Education Allowance rate, prorated same as basicSalary. Defaults to 0. */
  cea?: number;
  /** Monthly Misc. Allowance rate, prorated same as basicSalary and rounded to the rupee (matching the source sheet). Defaults to 0. */
  miscAllow?: number;
  /** Actual calendar days in the period (e.g. 30 for June, 31 for July) — the per-day rate divisor. */
  monthDays: number;
  /** Manual input; workingDays = actualPresentDays + weekOffHoliday. */
  actualPresentDays: number;
  /** Manual input. */
  weekOffHoliday: number;
  otHours: number;
  /** Monthly incentive allowance rate; the earned `incentive` is prorated from this like basicEarn is from basicSalary. Defaults to 0. */
  incentiveAllowRate?: number;
  /** Manual flat amount, not prorated. Defaults to 0. */
  attendAward?: number;
  /** Manual flat amount, feeds the OT stream's Gross Payable. Defaults to 0. */
  nightAllowance?: number;
  /** Manual flat amount, prior-period correction feeding the OT stream's Total Gross Payable. Defaults to 0. */
  otArrear?: number;
  /** Manual entry, not derived. */
  advance?: number;
  /** Manual entry. Defaults to 0. */
  tds?: number;
  /** Manual entry. Defaults to 0. */
  otherDeduction?: number;
  /** Manual entry, added to net payable. Defaults to 0. */
  leaveEncashment?: number;
  /** Manual entry, added to net payable ("Arrears / Suspension Allow / Advance Paid Against Salary"). Defaults to 0. */
  arrears?: number;
  /** Manual entry, added to net payable ("Bonus & Diwali"). Defaults to 0. */
  bonus?: number;
}

export interface WageResult {
  workingDays: number;
  basicEarn: number;
  hraEarn: number;
  taEarn: number;
  medicalEarn: number;
  ceaEarn: number;
  miscEarn: number;
  otAmount: number;
  incentive: number;
  attendAward: number;
  nightAllowance: number;
  otArrear: number;
  /** Basic + HRA + TA + Medical + CEA + Misc earned — the base ESIC/PF/Welfare are computed on. */
  grossWagesErnd: number;
  /** grossWagesErnd + the OT stream's Total Gross Payable — everything earned this period. */
  grossEarning: number;
  pf: number;
  esic: number;
  /** Employer's own ESIC contribution @ 3.25% of Gross Wages Ernd — informational/compliance, not billed to the client. */
  employerEsic: number;
  /** ESIC on the OT/night-allowance/incentive/attendance-award stream, separate from `esic`. */
  otEsic: number;
  lwf: number;
  advance: number;
  tds: number;
  otherDeduction: number;
  leaveEncashment: number;
  arrears: number;
  bonus: number;
  totalDeduction: number;
  netPayable: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ESIC and Welfare round UP to the nearest whole rupee in the source sheet — never round down a statutory contribution. */
function roundUp0(n: number): number {
  return Math.ceil(n);
}

/** PF (employee EPF 12%) rounds to the nearest whole rupee, not up. */
function round0(n: number): number {
  return Math.round(n);
}

function computeRaw(input: WageInput) {
  const {
    basicSalary,
    hra = 0,
    ta = 0,
    medicalAllow = 0,
    cea = 0,
    miscAllow = 0,
    monthDays,
    actualPresentDays,
    weekOffHoliday,
    otHours,
    incentiveAllowRate = 0,
    attendAward = 0,
    nightAllowance = 0,
    otArrear = 0,
    advance = 0,
    tds = 0,
    otherDeduction = 0,
    leaveEncashment = 0,
    arrears = 0,
    bonus = 0,
  } = input;

  const workingDays = actualPresentDays + weekOffHoliday;

  const basicEarn = (basicSalary / monthDays) * workingDays;
  const hraEarn = (hra / monthDays) * workingDays;
  const taEarn = (ta / monthDays) * workingDays;
  const medicalEarn = (medicalAllow / monthDays) * workingDays;
  const ceaEarn = (cea / monthDays) * workingDays;
  // Misc. Allowance Earned rounds to the rupee in its own source cell (unlike the other Ernd
  // columns), so the rounded value — not the raw one — is what Gross Wages Ernd sums.
  const miscEarn = Math.round((miscAllow / monthDays) * workingDays);

  const otAmount = (basicSalary / monthDays / 8) * otHours * 2; // double rate
  const incentive = (incentiveAllowRate / monthDays) * workingDays;

  const grossWagesErnd = basicEarn + hraEarn + taEarn + medicalEarn + ceaEarn + miscEarn;
  const otGrossPayable = otAmount + nightAllowance + attendAward + incentive;
  const otTotalGrossPayable = otGrossPayable + otArrear;
  const grossEarning = grossWagesErnd + otTotalGrossPayable;

  const pfWages = Math.min(basicEarn, PF_WAGE_CEILING);
  const pf = (pfWages * 12) / 100;
  const esic = (grossWagesErnd * 0.75) / 100;
  const employerEsic = (grossWagesErnd * 3.25) / 100;
  const lwf = grossWagesErnd >= LWF_GROSS_THRESHOLD ? LWF_FLAT_ABOVE_THRESHOLD : (grossWagesErnd * 0.2) / 100;
  const otEsic = (otTotalGrossPayable * 0.75) / 100;

  const totalDeduction = otherDeduction + advance + tds + pf + esic + lwf + otEsic;
  const netPayable = grossEarning + arrears + bonus + leaveEncashment - totalDeduction;

  return {
    workingDays,
    basicEarn,
    hraEarn,
    taEarn,
    medicalEarn,
    ceaEarn,
    miscEarn,
    otAmount,
    incentive,
    attendAward,
    nightAllowance,
    otArrear,
    grossWagesErnd,
    grossEarning,
    pf,
    esic,
    employerEsic,
    otEsic,
    lwf,
    advance,
    tds,
    otherDeduction,
    leaveEncashment,
    arrears,
    bonus,
    totalDeduction,
    netPayable,
  };
}

export function calculateWageLine(input: WageInput): WageResult {
  const raw = computeRaw(input);
  const pf = round0(raw.pf);
  const esic = roundUp0(raw.esic);
  const employerEsic = roundUp0(raw.employerEsic);
  const otEsic = roundUp0(raw.otEsic);
  const lwf = roundUp0(raw.lwf);
  const advance = round2(raw.advance);
  const tds = round2(raw.tds);
  const otherDeduction = round2(raw.otherDeduction);
  const leaveEncashment = round2(raw.leaveEncashment);
  const arrears = round2(raw.arrears);
  const bonus = round2(raw.bonus);
  const totalDeduction = otherDeduction + advance + tds + pf + esic + lwf + otEsic;
  const grossEarning = round2(raw.grossEarning);
  return {
    workingDays: round2(raw.workingDays),
    basicEarn: round2(raw.basicEarn),
    hraEarn: round2(raw.hraEarn),
    taEarn: round2(raw.taEarn),
    medicalEarn: round2(raw.medicalEarn),
    ceaEarn: round2(raw.ceaEarn),
    miscEarn: round2(raw.miscEarn),
    otAmount: round2(raw.otAmount),
    incentive: round2(raw.incentive),
    attendAward: round2(raw.attendAward),
    nightAllowance: round2(raw.nightAllowance),
    otArrear: round2(raw.otArrear),
    grossWagesErnd: round2(raw.grossWagesErnd),
    grossEarning,
    pf,
    esic,
    employerEsic,
    otEsic,
    lwf,
    advance,
    tds,
    otherDeduction,
    leaveEncashment,
    arrears,
    bonus,
    totalDeduction,
    netPayable: round2(grossEarning + arrears + bonus + leaveEncashment - totalDeduction),
  };
}

/**
 * Row 19 column totals. Earned figures (basicEarn, hraEarn, etc.) have no
 * rounding in the source sheet's own formulas, so their totals sum each
 * worker's full-precision raw value before rounding once — matching
 * Excel's SUM(), which reads the unrounded underlying cell. Statutory
 * deductions (pf/esic/employerEsic/otEsic/lwf) DO round per worker in the
 * source (each is its own ROUND()/ROUNDUP() cell), so their total instead
 * sums the already-rounded per-worker values, same as the source's SUM()
 * over those cells.
 */
export function sumWageLines(
  lines: WageInput[]
): Omit<WageResult, "pf" | "esic" | "employerEsic" | "otEsic" | "lwf" | "advance" | "tds" | "otherDeduction"> {
  const raws = lines.map(computeRaw);
  const rows = lines.map(calculateWageLine);
  const sumRaw = (pick: (r: ReturnType<typeof computeRaw>) => number) => round2(raws.reduce((acc, r) => acc + pick(r), 0));
  const sumRounded = (pick: (r: WageResult) => number) => round2(rows.reduce((acc, r) => acc + pick(r), 0));

  const grossEarning = sumRaw((r) => r.grossEarning);
  const totalDeduction = sumRounded((r) => r.totalDeduction);
  const arrears = sumRounded((r) => r.arrears);
  const bonus = sumRounded((r) => r.bonus);
  const leaveEncashment = sumRounded((r) => r.leaveEncashment);

  return {
    workingDays: sumRaw((r) => r.workingDays),
    basicEarn: sumRaw((r) => r.basicEarn),
    hraEarn: sumRaw((r) => r.hraEarn),
    taEarn: sumRaw((r) => r.taEarn),
    medicalEarn: sumRaw((r) => r.medicalEarn),
    ceaEarn: sumRaw((r) => r.ceaEarn),
    miscEarn: sumRaw((r) => r.miscEarn),
    otAmount: sumRaw((r) => r.otAmount),
    incentive: sumRaw((r) => r.incentive),
    attendAward: sumRaw((r) => r.attendAward),
    nightAllowance: sumRaw((r) => r.nightAllowance),
    otArrear: sumRaw((r) => r.otArrear),
    grossWagesErnd: sumRaw((r) => r.grossWagesErnd),
    grossEarning,
    arrears,
    bonus,
    leaveEncashment,
    totalDeduction,
    netPayable: round2(grossEarning + arrears + bonus + leaveEncashment - totalDeduction),
  };
}
