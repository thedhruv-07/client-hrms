import ExcelJS from "exceljs";

const MONEY_FORMAT = "#,##0.00";

/** Triggers a browser file-save for an in-memory blob — shared by every download function that needs one. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, filename);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E5DD" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD8DCD3" } } };
  });
}

/**
 * Sets money number format + right-alignment for the given columns, skipping the first
 * `headerRows` rows. Column-level `.alignment =` applies to every cell in the column
 * including the header — applying it unconditionally silently overwrote header cells'
 * centered alignment back to right-only, which is exactly the "headers not centered" bug
 * this row-skipping guards against.
 */
function applyMoneyFormat(sheet: ExcelJS.Worksheet, keys: string[], headerRows = 1) {
  for (const key of keys) {
    sheet.getColumn(key).numFmt = MONEY_FORMAT;
  }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRows) return;
    for (const key of keys) {
      row.getCell(key).alignment = { horizontal: "right" };
    }
  });
}

export interface WageRegisterSheetRow {
  code: string;
  name: string;
  fatherHusbandName: string | null;
  category: string | null;
  designation: string | null;
  esicNo: string | null;
  uan: string | null;
  pfNo: string | null;
  basicSalary: number;
  hra: number;
  ta: number;
  medicalAllow: number;
  cea: number;
  miscAllow: number;
  /** Actual calendar days in the period (30/31/28/29) — the per-day rate divisor. */
  monthDays: number;
  actualPresentDays: number;
  weekOffHoliday: number;
  basicEarn: number;
  hraEarn: number;
  taEarn: number;
  medicalEarn: number;
  ceaEarn: number;
  miscEarn: number;
  /** Basic+HRA+TA+Medical+CEA+Misc earned — the base ESIC/PF/Welfare are computed on. Regular-wages stream only, no OT. */
  grossEarning: number;
  pf: number;
  esic: number;
  employerEsic: number;
  lwf: number;
  tds: number;
  advance: number;
  otherDeduction: number;
  leaveEncashment: number;
  arrears: number;
  bonus: number;
  totalDeduction: number;
  netPayable: number;
}

export interface WageRegisterSheetTotals {
  basicEarn: number;
  hraEarn: number;
  taEarn: number;
  medicalEarn: number;
  ceaEarn: number;
  miscEarn: number;
  grossEarning: number;
  pf: number;
  esic: number;
  employerEsic: number;
  lwf: number;
  tds: number;
  advance: number;
  otherDeduction: number;
  leaveEncashment: number;
  arrears: number;
  bonus: number;
  totalDeduction: number;
  netPayable: number;
}

export interface OtCalculationSheetRow {
  code: string;
  name: string;
  fatherHusbandName: string | null;
  category: string | null;
  designation: string | null;
  monthDays: number;
  actualPresentDays: number;
  weekOffHoliday: number;
  otHours: number;
  /** "New Basic" in the source sheet — the worker's basic rate. */
  basicSalary: number;
  incentiveAllowRate: number;
  otAmount: number;
  nightCount: number;
  nightAllowance: number;
  attendAward: number;
  incentive: number;
  grossPayable: number;
  otArrear: number;
  otEsic: number;
  netPayable: number;
}

export interface OtCalculationSheetTotals {
  otAmount: number;
  nightAllowance: number;
  attendAward: number;
  incentive: number;
  grossPayable: number;
  otArrear: number;
  otEsic: number;
  netPayable: number;
}

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE7E5DD" } };
const MEDIUM_GREY = { style: "medium" as const, color: { argb: "FF333333" } };

// Matches Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx's own fonts: Book Antiqua
// for the SALARY SHEET, Aptos for OT Calculation, Calibri for BILL CALCULATION.
const SALARY_SHEET_FONT = "Book Antiqua";
const OT_SHEET_FONT = "Aptos";
const BILL_SHEET_FONT = "Calibri";

/**
 * Mirrors the source workbook's "SALARY SHEET" — regular wages only (Basic +
 * HRA), matching the source's own split of regular pay from the separate OT
 * Calculation sheet. Per-row formulas (not static values) for every derived
 * cell, so opening the file and editing an input (basic salary, HRA,
 * working days, advance) recalculates everything downstream exactly like
 * the source workbook does. Returns the TOTAL row number so writeBillSheet
 * and writeOtCalculationSheet can cross-reference it.
 */
// Exact column order/headers from the source SALARY SHEET (A through AU).
const SALARY_COLS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "AB",
  "AC",
  "AD",
  "AE",
  "AF",
  "AG",
  "AH",
  "AI",
  "AJ",
  "AK",
  "AL",
  "AM",
  "AN",
  "AO",
  "AP",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
] as const;

function writeWageRegisterSheet(sheet: ExcelJS.Worksheet, data: { companyName: string; monthLabel: string; rows: WageRegisterSheetRow[]; totals: WageRegisterSheetTotals }): number {
  sheet.columns = SALARY_COLS.map((_, i) => ({ width: i < 3 ? 16 : 11 }));
  const LAST_COL = SALARY_COLS.length;

  const firstDataRow = 3;
  const lastDataRow = firstDataRow + data.rows.length - 1;
  const totalsRowNum = lastDataRow + 1;

  const titleRow = sheet.addRow([]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, LAST_COL);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.value = {
    richText: [
      { font: { bold: true, size: 14, name: SALARY_SHEET_FONT }, text: `${data.companyName}\n` },
      { font: { bold: true, size: 10, name: SALARY_SHEET_FONT }, text: `SALARY AND WAGES FOR THE MONTH OF ${data.monthLabel.toUpperCase()}` },
    ],
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const header = sheet.addRow([
    "S. No",
    "Emp. Code",
    "Name",
    "Father Name",
    "CATOGERY",
    "Designation",
    "ESI No.",
    "UAN No.",
    "PF NO.",
    "CTC",
    "Gross Salary",
    "Total",
    "Actual Present Days",
    "Week Off/ Holiday",
    "Absent",
    "Total Days",
    "BASIC",
    "Basic Ernd",
    "HRA",
    "HRA Ernd",
    "TA",
    "TA Ernd",
    "MEDICAL ALLOW.",
    "Medical Allows Ernd",
    "CEA",
    "CEA Ernd",
    "MISC. ALLOW",
    "Misc. Allows Ernd",
    "Gross Wages Ernd",
    "ESI Wages",
    "P.F Wages",
    "Employer ESIC Cont. 3.25%",
    "Employee ESIC Cont. 0.75%",
    "Employee EPF Cont. 12%",
    "Welfare employee",
    "Employer's Cont. To Welfare",
    "TDS",
    "Advance Deducted From Salary",
    "Other Deduction",
    "Leave Encashment",
    "Bonus & Diwali",
    "Arrears / Suspension Allow / Advance Paid Against Salary",
    "Total Deduction",
    "Net Amount Payable",
    "Bank",
    "Full & Final",
    "Separate Cheque",
  ]);
  header.height = 40;
  header.font = { bold: true, size: 9, name: SALARY_SHEET_FONT };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: THIN_GREY };
  });

  data.rows.forEach((r, i) => {
    const rn = firstDataRow + i;
    const row = sheet.addRow([
      i + 1,
      r.code,
      r.name,
      r.fatherHusbandName ?? "",
      r.category ?? "",
      r.designation ?? "",
      r.esicNo ?? "",
      r.uan ?? "",
      r.pfNo ?? "",
      { formula: `K${rn}`, result: r.basicSalary + r.hra + r.ta + r.medicalAllow + r.cea + r.miscAllow }, // CTC — same as Gross Salary; no separate CTC figure is tracked
      { formula: `Q${rn}+S${rn}+U${rn}+W${rn}+Y${rn}+AA${rn}`, result: r.basicSalary + r.hra + r.ta + r.medicalAllow + r.cea + r.miscAllow },
      r.monthDays,
      r.actualPresentDays,
      r.weekOffHoliday,
      { formula: `L${rn}-P${rn}`, result: r.monthDays - (r.actualPresentDays + r.weekOffHoliday) },
      { formula: `SUM(M${rn}:N${rn})`, result: r.actualPresentDays + r.weekOffHoliday },
      r.basicSalary,
      { formula: `(Q${rn}/L${rn})*P${rn}`, result: r.basicEarn },
      r.hra,
      { formula: `(S${rn}/L${rn})*P${rn}`, result: r.hraEarn },
      r.ta,
      { formula: `(U${rn}/L${rn})*P${rn}`, result: r.taEarn },
      r.medicalAllow,
      { formula: `(W${rn}/L${rn})*P${rn}`, result: r.medicalEarn },
      r.cea,
      { formula: `(Y${rn}/L${rn})*P${rn}`, result: r.ceaEarn },
      r.miscAllow,
      { formula: `ROUND((AA${rn}/L${rn})*P${rn},0)`, result: r.miscEarn },
      { formula: `R${rn}+T${rn}+V${rn}+X${rn}+Z${rn}+AB${rn}`, result: r.grossEarning },
      { formula: `AC${rn}`, result: r.grossEarning },
      { formula: `MIN(R${rn},15000)`, result: Math.min(r.basicEarn, 15000) },
      { formula: `ROUNDUP(AD${rn}*3.25%,0)`, result: r.employerEsic },
      { formula: `ROUNDUP(AD${rn}*0.75%,0)`, result: r.esic },
      { formula: `ROUND(AE${rn}*12%,0)`, result: r.pf },
      { formula: `IF(AC${rn}>=17500,35,ROUNDUP(AC${rn}*0.2%,0))`, result: r.lwf },
      { formula: `AI${rn}*2`, result: r.lwf * 2 },
      r.tds,
      r.advance,
      r.otherDeduction,
      r.leaveEncashment,
      r.bonus,
      r.arrears,
      { formula: `AM${rn}+AL${rn}+AK${rn}+AH${rn}+AG${rn}+AI${rn}`, result: r.totalDeduction },
      { formula: `AC${rn}+AP${rn}+AO${rn}+AN${rn}-AQ${rn}`, result: r.netPayable },
      { formula: `AR${rn}`, result: r.netPayable },
      { formula: `AR${rn}-AS${rn}`, result: 0 },
      "",
    ]);
    row.font = { size: 9, name: SALARY_SHEET_FONT };
    row.eachCell((cell) => (cell.border = { bottom: THIN_GREY }));
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
  });

  const totalsRow = sheet.addRow(
    SALARY_COLS.map((col) => {
      switch (col) {
        case "C":
          return "TOTAL";
        case "R":
          return { formula: `SUM(R${firstDataRow}:R${lastDataRow})`, result: data.totals.basicEarn };
        case "T":
          return { formula: `SUM(T${firstDataRow}:T${lastDataRow})`, result: data.totals.hraEarn };
        case "V":
          return { formula: `SUM(V${firstDataRow}:V${lastDataRow})`, result: data.totals.taEarn };
        case "X":
          return { formula: `SUM(X${firstDataRow}:X${lastDataRow})`, result: data.totals.medicalEarn };
        case "Z":
          return { formula: `SUM(Z${firstDataRow}:Z${lastDataRow})`, result: data.totals.ceaEarn };
        case "AB":
          return { formula: `SUM(AB${firstDataRow}:AB${lastDataRow})`, result: data.totals.miscEarn };
        case "AC":
        case "AD":
          return { formula: `SUM(AC${firstDataRow}:AC${lastDataRow})`, result: data.totals.grossEarning };
        case "AF":
          return { formula: `SUM(AF${firstDataRow}:AF${lastDataRow})`, result: data.totals.employerEsic };
        case "AG":
          return { formula: `SUM(AG${firstDataRow}:AG${lastDataRow})`, result: data.totals.esic };
        case "AH":
          return { formula: `SUM(AH${firstDataRow}:AH${lastDataRow})`, result: data.totals.pf };
        case "AI":
          return { formula: `SUM(AI${firstDataRow}:AI${lastDataRow})`, result: data.totals.lwf };
        case "AJ":
          return { formula: `SUM(AJ${firstDataRow}:AJ${lastDataRow})`, result: data.totals.lwf * 2 };
        case "AK":
          return { formula: `SUM(AK${firstDataRow}:AK${lastDataRow})`, result: data.totals.tds };
        case "AL":
          return { formula: `SUM(AL${firstDataRow}:AL${lastDataRow})`, result: data.totals.advance };
        case "AM":
          return { formula: `SUM(AM${firstDataRow}:AM${lastDataRow})`, result: data.totals.otherDeduction };
        case "AN":
          return { formula: `SUM(AN${firstDataRow}:AN${lastDataRow})`, result: data.totals.leaveEncashment };
        case "AO":
          return { formula: `SUM(AO${firstDataRow}:AO${lastDataRow})`, result: data.totals.bonus };
        case "AP":
          return { formula: `SUM(AP${firstDataRow}:AP${lastDataRow})`, result: data.totals.arrears };
        case "AQ":
          return { formula: `SUM(AQ${firstDataRow}:AQ${lastDataRow})`, result: data.totals.totalDeduction };
        case "AR":
        case "AS":
          return { formula: `SUM(AR${firstDataRow}:AR${lastDataRow})`, result: data.totals.netPayable };
        default:
          return "";
      }
    })
  );
  totalsRow.font = { bold: true, size: 10, name: SALARY_SHEET_FONT };
  totalsRow.eachCell((cell) => (cell.border = { top: MEDIUM_GREY }));

  applyMoneyFormat(sheet, ["J", "K", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT"], 2);

  return totalsRowNum;
}

/**
 * Mirrors the source workbook's "OT Calculation" sheet — the OT/incentive/
 * attendance-award pay stream, kept separate from regular wages exactly
 * like the source keeps it as its own sheet with its own ESIC deduction and
 * Net Payable. Returns the TOTAL row number so writeBillSheet can
 * cross-reference it.
 */
// Exact column order/headers from the source "OT Calculation" sheet (A through V).
// monthDays isn't its own column in the source (it hardcodes 30 in-formula) — this
// export embeds the period's real calendar days as a literal in each formula instead,
// the same "actual days, not hard-coded 30" improvement the wage engine already makes.
const OT_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"] as const;

function writeOtCalculationSheet(sheet: ExcelJS.Worksheet, data: { companyName: string; monthLabel: string; monthDays: number; rows: OtCalculationSheetRow[]; totals: OtCalculationSheetTotals }): number {
  sheet.columns = OT_COLS.map((_, i) => ({ width: i < 3 ? 16 : 12 }));
  const LAST_COL = OT_COLS.length;

  const firstDataRow = 3;
  const lastDataRow = firstDataRow + data.rows.length - 1;
  const totalsRowNum = lastDataRow + 1;
  const { monthDays } = data;

  const titleRow = sheet.addRow([]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, LAST_COL);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.value = {
    richText: [
      { font: { bold: true, size: 14, name: OT_SHEET_FONT }, text: `${data.companyName}\n` },
      { font: { bold: true, size: 10, name: OT_SHEET_FONT }, text: `OVERTIME SHEET FOR THE MONTH OF ${data.monthLabel.toUpperCase()}` },
    ],
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const header = sheet.addRow([
    "S.No.",
    "Emp Code",
    "Employee Name",
    "Father Name",
    "CATOGERY",
    "Designation",
    "Total Days",
    "OT Hours",
    "New Basic",
    "INCENTIVE ALLOW RATE",
    "OT Amount",
    "No. of Nights",
    "Night Allowance",
    "Attendance Award",
    "Incentive Amount",
    "Gross Payable",
    "Overtime Arrear",
    "Total Gross Payable",
    "ESIC @ 0.75%",
    "Net Payable",
    "Bank",
    "Separate Cheque",
  ]);
  header.height = 40;
  header.font = { bold: true, size: 9, name: OT_SHEET_FONT };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: THIN_GREY };
  });

  data.rows.forEach((r, i) => {
    const rn = firstDataRow + i;
    const totalDays = r.actualPresentDays + r.weekOffHoliday;
    const row = sheet.addRow([
      i + 1,
      r.code,
      r.name,
      r.fatherHusbandName ?? "",
      r.category ?? "",
      r.designation ?? "",
      totalDays,
      r.otHours,
      r.basicSalary,
      r.incentiveAllowRate,
      { formula: `I${rn}*2/${monthDays}/8*H${rn}`, result: r.otAmount },
      r.nightCount,
      r.nightAllowance,
      r.attendAward,
      { formula: `ROUND(J${rn}/${monthDays}*G${rn},0)`, result: r.incentive },
      { formula: `SUM(K${rn},M${rn},N${rn},O${rn})`, result: r.otAmount + r.nightAllowance + r.attendAward + r.incentive },
      r.otArrear,
      { formula: `P${rn}+Q${rn}`, result: r.grossPayable },
      { formula: `ROUNDUP(R${rn}*0.75%,0)`, result: r.otEsic },
      { formula: `R${rn}-S${rn}`, result: r.netPayable },
      { formula: `T${rn}`, result: r.netPayable },
      { formula: `U${rn}-T${rn}`, result: 0 },
    ]);
    row.font = { size: 9, name: OT_SHEET_FONT };
    row.eachCell((cell) => (cell.border = { bottom: THIN_GREY }));
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(8).alignment = { horizontal: "center" };
  });

  const totalsRow = sheet.addRow(
    OT_COLS.map((col) => {
      switch (col) {
        case "D":
          return "Total";
        case "K":
          return { formula: `SUM(K${firstDataRow}:K${lastDataRow})`, result: data.totals.otAmount };
        case "M":
          return { formula: `SUM(M${firstDataRow}:M${lastDataRow})`, result: data.totals.nightAllowance };
        case "N":
          return { formula: `SUM(N${firstDataRow}:N${lastDataRow})`, result: data.totals.attendAward };
        case "O":
          return { formula: `SUM(O${firstDataRow}:O${lastDataRow})`, result: data.totals.incentive };
        case "P":
          return { formula: `SUM(P${firstDataRow}:P${lastDataRow})`, result: data.totals.grossPayable };
        case "Q":
          return { formula: `SUM(Q${firstDataRow}:Q${lastDataRow})`, result: data.totals.otArrear };
        case "R":
          return { formula: `SUM(R${firstDataRow}:R${lastDataRow})`, result: data.totals.grossPayable + data.totals.otArrear };
        case "S":
          return { formula: `SUM(S${firstDataRow}:S${lastDataRow})`, result: data.totals.otEsic };
        case "T":
        case "U":
          return { formula: `SUM(T${firstDataRow}:T${lastDataRow})`, result: data.totals.netPayable };
        default:
          return "";
      }
    })
  );
  totalsRow.font = { bold: true, size: 10, name: OT_SHEET_FONT };
  totalsRow.eachCell((cell) => (cell.border = { top: MEDIUM_GREY }));

  applyMoneyFormat(sheet, ["I", "J", "K", "M", "N", "O", "P", "Q", "R", "S", "T", "U"], 2);

  return totalsRowNum;
}

export interface InHousePayrollRow {
  code: string;
  name: string;
  unpaidLeaveDays: number;
  bonus: number;
  incentive: number;
  advance: number;
  grossEarning: number;
  pf: number;
  esic: number;
  totalDeduction: number;
  netPayable: number;
}

export interface InHousePayrollTotals {
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

export async function downloadInHousePayroll(params: { monthLabel: string; rows: InHousePayrollRow[]; totals: InHousePayrollTotals }): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Payroll Summary");
  sheet.columns = [
    { header: "Code", key: "code", width: 12 },
    { header: "Name", key: "name", width: 24 },
    { header: "Unpaid Leave", key: "unpaidLeaveDays", width: 14 },
    { header: "Bonus", key: "bonus", width: 14 },
    { header: "Incentive", key: "incentive", width: 14 },
    { header: "Advance", key: "advance", width: 14 },
    { header: "Gross Earning", key: "grossEarning", width: 16 },
    { header: "PF", key: "pf", width: 12 },
    { header: "ESIC", key: "esic", width: 12 },
    { header: "Total Deduction", key: "totalDeduction", width: 16 },
    { header: "Net Payable", key: "netPayable", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));
  params.rows.forEach((r) => sheet.addRow(r));
  const totalsRow = sheet.addRow({ code: "", name: "TOTAL", grossEarning: params.totals.grossEarning, totalDeduction: params.totals.totalDeduction, netPayable: params.totals.netPayable });
  totalsRow.font = { bold: true };
  totalsRow.border = { top: { style: "thin", color: { argb: "FFD8DCD3" } } };
  applyMoneyFormat(sheet, ["bonus", "incentive", "advance", "grossEarning", "pf", "esic", "totalDeduction", "netPayable"]);

  await downloadWorkbook(wb, `inhouse-payroll-${params.monthLabel.toLowerCase()}.xlsx`);
}

export interface SalarySlipAttendance {
  monthDays: number;
  present: number;
  weekOff: number;
  holiday: number;
  cl: number;
  sl: number;
  lwp: number;
  payableDays: number;
  otHours: number;
}

export interface SalarySlipExportData {
  companyName: string;
  companyAddress: string;
  companyGstNo: string | null;
  employeeCode: string;
  employeeName: string;
  fatherHusbandName: string | null;
  department: string;
  designation: string;
  location: string | null;
  paymentMode: string | null;
  monthLabel: string;
  bankAccount: string | null;
  ifsc: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uan: string | null;
  attendance: SalarySlipAttendance;
  earnings: { label: string; rate: number; payable: number }[];
  deductions: { label: string; amount: number }[];
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

const MUTED_GREY = { argb: "FF666666" };
const THIN_GREY = { style: "thin" as const, color: { argb: "FFD8DCD3" } };

function addMergedRow(sheet: ExcelJS.Worksheet, text: string, opts: { bold?: boolean; size?: number; color?: Partial<ExcelJS.Color>; italic?: boolean; align?: "center" | "right" } = {}, endCol = 4) {
  const row = sheet.addRow([text]);
  sheet.mergeCells(row.number, 1, row.number, endCol);
  const cell = row.getCell(1);
  cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, italic: opts.italic ?? false, color: opts.color };
  cell.alignment = { horizontal: opts.align ?? "center" };
  return row;
}

function writeSlipSheet(sheet: ExcelJS.Worksheet, slip: SalarySlipExportData) {
  sheet.columns = [{ width: 16 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 12 }, { width: 12 }];

  const sigRow = sheet.addRow(["Authorised Signatory", "", "", "", "", "Employee's Signature"]);
  sigRow.getCell(1).font = { size: 9, color: MUTED_GREY };
  sigRow.getCell(6).font = { size: 9, color: MUTED_GREY };
  sigRow.getCell(6).alignment = { horizontal: "right" };
  sigRow.eachCell((cell) => (cell.border = { bottom: THIN_GREY }));
  sheet.addRow([]);

  addMergedRow(sheet, slip.companyName, { bold: true, size: 15 }, 6);
  addMergedRow(sheet, slip.companyAddress, { size: 9, color: MUTED_GREY }, 6);
  if (slip.companyGstNo) addMergedRow(sheet, `GSTIN: ${slip.companyGstNo}`, { size: 9, color: MUTED_GREY }, 6);
  addMergedRow(sheet, `Payslip For The Month Of : ${slip.monthLabel}`, { bold: true, size: 11 }, 6);
  sheet.addRow([]);

  // One grid — Employee Details, Attendance, Allowance/Payable, and Deductions run as
  // parallel columns sharing the same rows, matching the source payslip exactly.
  const bankAc = slip.bankAccount ? `${slip.bankAccount}${slip.ifsc ? ` (${slip.ifsc})` : ""}` : undefined;
  const empRows = (
    [
      ["Employee Code", slip.employeeCode],
      ["Employee Name", slip.employeeName],
      ["Father / Husband", slip.fatherHusbandName],
      ["Department", slip.department],
      ["Designation", slip.designation],
      ["Payment Mode", slip.paymentMode],
      ["A/C No.", bankAc],
      ["ESI No.", slip.esicNo],
      ["UAN", slip.uan],
      ["Location", slip.location],
    ] as [string, string | null | undefined][]
  )
    .filter(([, v]) => !!v)
    .map(([label, value]) => `${label} : ${value}`);

  const a = slip.attendance;
  const attRows = [
    `Month Days : ${a.monthDays}`,
    `Present : ${a.present}`,
    `W.Off : ${a.weekOff}`,
    `Holiday : ${a.holiday}`,
    `CL : ${a.cl}`,
    `SL : ${a.sl}`,
    `LWP : ${a.lwp}`,
    `Payable : ${a.payableDays}`,
    `OT : ${a.otHours}`,
  ];

  const dedRows = slip.deductions.map((l) => `${l.label} : ${l.amount.toFixed(2)}`);

  const gridHeader = sheet.addRow(["Employee Details", "Attendance", "Allowance", "", "Payable", "Deductions"]);
  sheet.mergeCells(gridHeader.number, 3, gridHeader.number, 4);
  styleHeaderRow(gridHeader);

  const maxRows = Math.max(empRows.length, attRows.length, slip.earnings.length, dedRows.length);
  for (let i = 0; i < maxRows; i++) {
    const e = slip.earnings[i];
    const row = sheet.addRow([empRows[i] ?? "", attRows[i] ?? "", e?.label ?? "", e?.rate, e?.payable, dedRows[i] ?? ""]);
    row.getCell(4).numFmt = MONEY_FORMAT;
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(5).numFmt = MONEY_FORMAT;
    row.getCell(5).alignment = { horizontal: "right" };
    row.eachCell((cell) => (cell.border = { bottom: THIN_GREY }));
  }
  const earningsRateTotal = slip.earnings.reduce((sum, l) => sum + l.rate, 0);
  const totalRow = sheet.addRow(["", "", "Total :", earningsRateTotal, slip.grossEarning, slip.totalDeduction]);
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = MONEY_FORMAT;
  totalRow.getCell(4).alignment = { horizontal: "right" };
  totalRow.getCell(5).numFmt = MONEY_FORMAT;
  totalRow.getCell(5).alignment = { horizontal: "right" };
  totalRow.getCell(6).numFmt = MONEY_FORMAT;
  totalRow.getCell(6).alignment = { horizontal: "right" };
  totalRow.eachCell((cell) => (cell.border = { top: THIN_GREY }));
  sheet.addRow([]);

  const netRow = sheet.addRow(["Net Salary", slip.netPayable]);
  const netBorder = { style: "medium" as const, color: { argb: "FF333333" } };
  netRow.getCell(2).numFmt = MONEY_FORMAT;
  netRow.getCell(2).alignment = { horizontal: "right" };
  netRow.eachCell((cell) => {
    cell.font = { bold: true, size: 13 };
    cell.border = { top: netBorder, bottom: netBorder };
  });

  addMergedRow(sheet, amountInWords(slip.netPayable), { italic: true, size: 9, color: MUTED_GREY, align: "right" }, 6);
  sheet.addRow([]);

  const footerSigRow = sheet.addRow(["Authorised Signatory", "", "", "", "", "Employee's Signature"]);
  footerSigRow.getCell(1).font = { size: 9, color: MUTED_GREY };
  footerSigRow.getCell(6).font = { size: 9, color: MUTED_GREY };
  footerSigRow.getCell(6).alignment = { horizontal: "right" };
  footerSigRow.eachCell((cell) => (cell.border = { top: THIN_GREY }));
}

export async function downloadSalarySlip(slip: SalarySlipExportData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  writeSlipSheet(wb.addWorksheet("Salary Slip"), slip);
  await downloadWorkbook(wb, `salary-slip-${slip.employeeCode}-${slip.monthLabel.toLowerCase()}.xlsx`);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsInWords(n: number): string {
  if (n < 20) return ONES[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones ? " " + ONES[ones] : ""}`;
}

function threeDigitsInWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${hundreds ? ONES[hundreds] + " Hundred" + (rest ? " " : "") : ""}${rest ? twoDigitsInWords(rest) : ""}`;
}

/** Indian numbering (crore/lakh/thousand), whole rupees only — matches the printed bill's "Rs. ... Only." line. */
export function amountInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "Rs. Zero Only.";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsInWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsInWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsInWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsInWords(hundred));
  return `Rs. ${parts.join(" ")} Only.`;
}

export interface BillExportData {
  billNo: string;
  billDate: string;
  monthLabel: string;
  monthLabelShort: string;
  company: { name: string; address: string; mobile: string | null; email: string | null; gstNo: string | null; pfCode: string | null; esiCode: string | null; bankAccount: string | null; ifsc: string | null; branch: string | null };
  client: { name: string; address: string; gstNo: string | null; panNo: string | null; hsnSac: string | null };
  line: {
    basicWages: number;
    hra: number;
    otAmount: number;
    attendAward: number;
    incentiveAmt: number;
    total1: number;
    esiEmployer: number;
    pfBase: number;
    pfEmployer: number;
    lwf: number;
    serviceCharge: number;
    total2: number;
    cgst: number;
    sgst: number;
    grandTotal: number;
  };
}

interface WageTableRef {
  sheetName: string;
  totalsRow: number;
}

/**
 * Mirrors the source workbook's "BILL CALCULATION" sheet row-for-row (Calibri, its own font).
 * Every derived cell (TOTAL (1)/(2), the ESI/PF/service-charge percentages, CGST/SGST, GRAND
 * TOTAL) is a live formula. Basic Wages/HRA link to the wage-register sheet's TOTAL row and
 * OT Amount/Attend. Award/Incentive Amt link to the OT Calculation sheet's TOTAL row when
 * `wageRef`/`otRef` are given (the combined workbook); standalone (no other sheets in the
 * file) they're plain editable inputs.
 */
function writeBillSheet(sheet: ExcelJS.Worksheet, data: BillExportData, wageRef?: WageTableRef, otRef?: WageTableRef) {
  const { company, client, line } = data;
  sheet.columns = [{ width: 26 }, { width: 20 }, { width: 16 }, { width: 16 }];

  const nameRow = sheet.addRow([company.name]);
  sheet.mergeCells(nameRow.number, 1, nameRow.number, 4);
  nameRow.height = 24;
  nameRow.getCell(1).font = { bold: true, size: 16, name: BILL_SHEET_FONT };
  nameRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const addressRow = sheet.addRow([company.address]);
  sheet.mergeCells(addressRow.number, 1, addressRow.number, 4);
  addressRow.getCell(1).font = { size: 10, color: MUTED_GREY, name: BILL_SHEET_FONT };
  addressRow.getCell(1).alignment = { horizontal: "center", wrapText: true };

  const contactParts = [company.mobile ? `Mob. ${company.mobile}` : "", company.email ? `Email: ${company.email}` : ""].filter(Boolean);
  const mobRow = sheet.addRow([contactParts.join(" | ")]);
  sheet.mergeCells(mobRow.number, 1, mobRow.number, 4);
  mobRow.getCell(1).font = { size: 10, color: MUTED_GREY, name: BILL_SHEET_FONT };
  mobRow.getCell(1).alignment = { horizontal: "center" };

  const billRow = sheet.addRow([`Bill No: ${data.billNo}`, "", new Date(data.billDate).toLocaleDateString("en-IN")]);
  billRow.font = { size: 11, name: BILL_SHEET_FONT };
  billRow.getCell(3).alignment = { horizontal: "right" };

  const clientNameRow = sheet.addRow([`M/s ${client.name}`, "", "GST. NO.", client.gstNo ?? ""]);
  clientNameRow.getCell(1).font = { bold: true, size: 12, name: BILL_SHEET_FONT };
  clientNameRow.getCell(3).font = { size: 10, color: MUTED_GREY, name: BILL_SHEET_FONT };
  clientNameRow.getCell(3).alignment = { horizontal: "right" };
  clientNameRow.getCell(4).font = { bold: true, size: 10, name: BILL_SHEET_FONT };

  const clientAddrRow = sheet.addRow([client.address, "", "PAN NO.", client.panNo ?? ""]);
  clientAddrRow.height = 28;
  clientAddrRow.getCell(1).font = { size: 10, name: BILL_SHEET_FONT };
  clientAddrRow.getCell(1).alignment = { wrapText: true };
  clientAddrRow.getCell(3).font = { size: 10, color: MUTED_GREY, name: BILL_SHEET_FONT };
  clientAddrRow.getCell(3).alignment = { horizontal: "right" };
  clientAddrRow.getCell(4).font = { bold: true, size: 10, name: BILL_SHEET_FONT };

  const pfCodeRow = sheet.addRow(["", "", "PF CODE", company.pfCode ?? ""]);
  pfCodeRow.getCell(3).font = { size: 10, color: MUTED_GREY, name: BILL_SHEET_FONT };
  pfCodeRow.getCell(3).alignment = { horizontal: "right" };
  pfCodeRow.getCell(4).font = { bold: true, size: 10, name: BILL_SHEET_FONT };

  const gstRow = sheet.addRow([`GST NO :${company.gstNo ?? ""}`, "", "ESI CODE / HSN-SAC", `${company.esiCode ?? ""} ${client.hsnSac ?? ""}`.trim()]);
  gstRow.getCell(1).font = { bold: true, size: 10, name: BILL_SHEET_FONT };
  gstRow.getCell(3).font = { size: 10, color: MUTED_GREY, name: BILL_SHEET_FONT };
  gstRow.getCell(3).alignment = { horizontal: "right" };
  gstRow.getCell(4).font = { bold: true, size: 10, name: BILL_SHEET_FONT };

  const titleRow = sheet.addRow([`BILL FOR THE MONTH OF ${data.monthLabel.toUpperCase()}`]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 4);
  titleRow.getCell(1).font = { bold: true, size: 12, name: BILL_SHEET_FONT };
  titleRow.getCell(1).alignment = { horizontal: "center" };

  const header = sheet.addRow(["PARTICULARS", "ATTENDANCE", "RATE", "AMOUNT"]);
  header.height = 20;
  header.font = { bold: true, size: 10, name: BILL_SHEET_FONT };
  header.alignment = { horizontal: "center", vertical: "middle" };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: THIN_GREY };
  });
  header.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  const basicWagesRow = sheet.addRow([`Basic Wages (${data.monthLabelShort})`]);
  basicWagesRow.getCell(4).value = wageRef ? { formula: `'${wageRef.sheetName}'!R${wageRef.totalsRow}`, result: line.basicWages } : line.basicWages;
  basicWagesRow.font = { size: 10, name: BILL_SHEET_FONT };
  const basicWagesRowNum = basicWagesRow.number;

  const hraRow = sheet.addRow(["HRA"]);
  hraRow.getCell(4).value = wageRef ? { formula: `'${wageRef.sheetName}'!T${wageRef.totalsRow}`, result: line.hra } : line.hra;
  hraRow.font = { size: 10, name: BILL_SHEET_FONT };
  const otRow = sheet.addRow(["OT AMOUNT"]);
  otRow.getCell(4).value = otRef ? { formula: `'${otRef.sheetName}'!K${otRef.totalsRow}`, result: line.otAmount } : line.otAmount;
  otRow.font = { size: 10, name: BILL_SHEET_FONT };
  const attendAwardRow = sheet.addRow(["ATTEND. AWARD"]);
  attendAwardRow.getCell(4).value = otRef ? { formula: `'${otRef.sheetName}'!N${otRef.totalsRow}`, result: line.attendAward } : line.attendAward;
  attendAwardRow.font = { size: 10, name: BILL_SHEET_FONT };
  const incentiveRow = sheet.addRow(["INCENTIVE AMT."]);
  incentiveRow.getCell(4).value = otRef ? { formula: `'${otRef.sheetName}'!O${otRef.totalsRow}`, result: line.incentiveAmt } : line.incentiveAmt;
  incentiveRow.font = { size: 10, name: BILL_SHEET_FONT };
  const incentiveRowNum = incentiveRow.number;

  const total1Row = sheet.addRow(["TOTAL (1)"]);
  total1Row.getCell(4).value = { formula: `SUM(D${basicWagesRowNum}:D${incentiveRowNum})`, result: line.total1 };
  total1Row.font = { bold: true, size: 11, name: BILL_SHEET_FONT };
  total1Row.eachCell((cell) => (cell.border = { top: THIN_GREY }));
  const total1RowNum = total1Row.number;

  const esi325Row = sheet.addRow(["ESI @ 3.25% ON"]);
  esi325Row.getCell(3).value = { formula: `D${total1RowNum}`, result: line.total1 };
  esi325Row.getCell(4).value = { formula: `ROUNDUP((C${esi325Row.number}*3.25)/100,0)`, result: line.esiEmployer };
  esi325Row.font = { size: 10, name: BILL_SHEET_FONT };

  const pfRow = sheet.addRow(["PF @ 13% ON"]);
  pfRow.getCell(3).value = line.pfBase;
  pfRow.getCell(4).value = { formula: `(C${pfRow.number}*13)/100`, result: line.pfEmployer };
  pfRow.font = { size: 10, name: BILL_SHEET_FONT };

  const lwfRow = sheet.addRow(["Labour Welfare Fund"]);
  lwfRow.getCell(4).value = wageRef ? { formula: `'${wageRef.sheetName}'!AI${wageRef.totalsRow}*2`, result: line.lwf } : line.lwf;
  lwfRow.font = { size: 10, name: BILL_SHEET_FONT };

  const serviceRow = sheet.addRow(["Service charges@5% on"]);
  serviceRow.getCell(3).value = { formula: `D${total1RowNum}`, result: line.total1 };
  serviceRow.getCell(4).value = { formula: `(C${serviceRow.number}*5)/100`, result: line.serviceCharge };
  serviceRow.font = { size: 10, name: BILL_SHEET_FONT };

  const total2Row = sheet.addRow(["TOTAL (2)"]);
  total2Row.getCell(4).value = { formula: `SUM(D${total1RowNum}:D${serviceRow.number})`, result: line.total2 };
  total2Row.font = { bold: true, size: 11, name: BILL_SHEET_FONT };
  total2Row.eachCell((cell) => (cell.border = { top: THIN_GREY }));
  const total2RowNum = total2Row.number;

  const cgstRow = sheet.addRow(["CGST @ 9% on"]);
  cgstRow.getCell(3).value = { formula: `D${total2RowNum}`, result: line.total2 };
  cgstRow.getCell(4).value = { formula: `(D${total2RowNum}*9)/100`, result: line.cgst };
  cgstRow.font = { size: 10, name: BILL_SHEET_FONT };

  const sgstRow = sheet.addRow(["SGST @ 9% on"]);
  sgstRow.getCell(3).value = { formula: `D${total2RowNum}`, result: line.total2 };
  sgstRow.getCell(4).value = { formula: `(D${total2RowNum}*9)/100`, result: line.sgst };
  sgstRow.font = { size: 10, name: BILL_SHEET_FONT };

  const grandTotalRow = sheet.addRow(["GRAND TOTAL"]);
  grandTotalRow.getCell(4).value = { formula: `SUM(D${total2RowNum}:D${sgstRow.number})`, result: line.grandTotal };
  grandTotalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 13, name: BILL_SHEET_FONT };
    cell.border = { top: MEDIUM_GREY, bottom: MEDIUM_GREY };
  });

  sheet.addRow([]);
  const wordsRow = sheet.addRow([amountInWords(line.grandTotal)]);
  sheet.mergeCells(wordsRow.number, 1, wordsRow.number, 4);
  wordsRow.getCell(1).font = { bold: true, size: 11, name: BILL_SHEET_FONT };

  const bankNameRow = sheet.addRow([company.name]);
  bankNameRow.getCell(1).font = { size: 10, name: BILL_SHEET_FONT };
  const bankAcRow = sheet.addRow([`A/C NO-${company.bankAccount ?? ""}`]);
  bankAcRow.getCell(1).font = { size: 10, name: BILL_SHEET_FONT };
  const bankIfscRow = sheet.addRow([`${company.ifsc ?? ""}   ${company.branch ?? ""}`]);
  bankIfscRow.getCell(1).font = { size: 10, name: BILL_SHEET_FONT };

  applyMoneyFormat(sheet, ["C", "D"], 10);
}

export async function downloadBill(data: BillExportData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  writeBillSheet(wb.addWorksheet("Bill"), data);
  await downloadWorkbook(wb, `bill-${data.billNo}-${data.monthLabel.toLowerCase()}.xlsx`);
}

export interface WageRegisterWithBillData {
  companyName: string;
  monthLabel: string;
  /** Actual calendar days in the period (30/31/28/29) — the OT sheet's per-hour rate divisor. */
  monthDays: number;
  rows: WageRegisterSheetRow[];
  totals: WageRegisterSheetTotals;
  otRows: OtCalculationSheetRow[];
  otTotals: OtCalculationSheetTotals;
  bill: BillExportData;
}

/** One workbook, three sheets — "Salary Sheet", "OT Calculation", and "Bill" — matching Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx's own layout, with the bill formula-linked to both. */
export async function downloadWageRegisterWithBill(data: WageRegisterWithBillData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const wageSheetName = "Salary Sheet";
  const otSheetName = "OT Calculation";
  const wageTotalsRow = writeWageRegisterSheet(wb.addWorksheet(wageSheetName), { companyName: data.companyName, monthLabel: data.monthLabel, rows: data.rows, totals: data.totals });
  const otTotalsRow = writeOtCalculationSheet(wb.addWorksheet(otSheetName), { companyName: data.companyName, monthLabel: data.monthLabel, monthDays: data.monthDays, rows: data.otRows, totals: data.otTotals });
  writeBillSheet(wb.addWorksheet("Bill"), data.bill, { sheetName: wageSheetName, totalsRow: wageTotalsRow }, { sheetName: otSheetName, totalsRow: otTotalsRow });
  await downloadWorkbook(wb, `wage-register-bill-${data.bill.billNo}-${data.monthLabel.toLowerCase()}.xlsx`);
}

export async function downloadSalarySlipsBatch(slips: SalarySlipExportData[], monthLabel: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  for (const slip of slips) {
    // Sheet names can't exceed 31 chars or contain []:*?/\\.
    const safeName = `${slip.employeeCode}`.slice(0, 31);
    writeSlipSheet(wb.addWorksheet(safeName), slip);
  }
  await downloadWorkbook(wb, `salary-slips-${monthLabel.toLowerCase()}.xlsx`);
}

export interface NeftPaymentRow {
  accountNumber: string;
  accountName: string;
  ifsc: string;
  amount: number;
}

/** Bank NEFT bulk-upload sheet — columns match "ROBOTICS FORMAT NEFT" exactly: SR No, Txn Type, Credit Account Number, Credit Account Name, IFSC, Amount, Narration. */
export async function downloadNeftSheet(rows: NeftPaymentRow[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  sheet.columns = [
    { header: "SR No", key: "sr", width: 8 },
    { header: "Txn Type", key: "txnType", width: 10 },
    { header: "Credit Account Number", key: "accountNumber", width: 22 },
    { header: "Credit Account Name", key: "accountName", width: 24 },
    { header: "IFSC", key: "ifsc", width: 14 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Narration", key: "narration", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));
  rows.forEach((r, i) => {
    sheet.addRow({ sr: i + 1, txnType: "NEFT", accountNumber: r.accountNumber, accountName: r.accountName.toUpperCase(), ifsc: r.ifsc, amount: r.amount, narration: "NEFT TRANSFER" });
  });
  const totalRow = sheet.addRow({ accountName: "Total", amount: rows.reduce((sum, r) => sum + r.amount, 0) });
  totalRow.font = { bold: true };
  totalRow.getCell("accountName").alignment = { horizontal: "right" };
  applyMoneyFormat(sheet, ["amount"]);
  await downloadWorkbook(wb, filename);
}

export interface WorkerDetailsSheetRow {
  code: string;
  name: string;
  fatherHusbandName: string | null;
  category: string | null;
  designation: string | null;
  clientName: string;
  basicSalary: number;
  hra: number;
  ta: number;
  medicalAllow: number;
  cea: number;
  miscAllow: number;
  bankAccount: string | null;
  ifsc: string | null;
  bankName: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uan: string | null;
  dob: string | null;
  doj: string | null;
  mobile: string | null;
  aadharNo: string | null;
  address: string | null;
  status: string;
}

/** Full worker master-data sheet — human-readable client name instead of the internal client id. */
export async function downloadWorkerDetailsSheet(rows: WorkerDetailsSheetRow[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Workers");
  sheet.columns = [
    { header: "Code", key: "code", width: 10 },
    { header: "Name", key: "name", width: 22 },
    { header: "Father / Husband Name", key: "fatherHusbandName", width: 22 },
    { header: "Category", key: "category", width: 14 },
    { header: "Designation", key: "designation", width: 16 },
    { header: "Client", key: "clientName", width: 22 },
    { header: "Basic Salary", key: "basicSalary", width: 12 },
    { header: "HRA", key: "hra", width: 10 },
    { header: "TA", key: "ta", width: 10 },
    { header: "Medical Allow.", key: "medicalAllow", width: 12 },
    { header: "CEA", key: "cea", width: 10 },
    { header: "Misc. Allow.", key: "miscAllow", width: 12 },
    { header: "Bank Account", key: "bankAccount", width: 20 },
    { header: "IFSC", key: "ifsc", width: 14 },
    { header: "Bank Name", key: "bankName", width: 18 },
    { header: "PF No.", key: "pfNo", width: 16 },
    { header: "ESIC No.", key: "esicNo", width: 14 },
    { header: "UAN", key: "uan", width: 16 },
    { header: "DOB", key: "dob", width: 12 },
    { header: "DOJ", key: "doj", width: 12 },
    { header: "Mobile", key: "mobile", width: 14 },
    { header: "Aadhar No.", key: "aadharNo", width: 16 },
    { header: "Address", key: "address", width: 30 },
    { header: "Status", key: "status", width: 10 },
  ];
  styleHeaderRow(sheet.getRow(1));
  rows.forEach((r) => sheet.addRow(r));
  applyMoneyFormat(sheet, ["basicSalary", "hra", "ta", "medicalAllow", "cea", "miscAllow"]);
  await downloadWorkbook(wb, filename);
}
