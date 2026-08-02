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
  basicSalary: number;
  /** Actual calendar days in the period (30/31/28/29) — the per-day rate divisor. */
  monthDays: number;
  workingDays: number;
  otHours: number;
  basicEarn: number;
  otAmount: number;
  grossEarning: number;
  esic: number;
  lwf: number;
  advance: number;
  totalDeduction: number;
  netPayable: number;
}

export interface WageRegisterSheetTotals {
  workingDays: number;
  basicEarn: number;
  otAmount: number;
  grossEarning: number;
  esic: number;
  lwf: number;
  advance: number;
  totalDeduction: number;
  netPayable: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE7E5DD" } };
const MEDIUM_GREY = { style: "medium" as const, color: { argb: "FF333333" } };

/**
 * Mirrors the source workbook's "Table 1" sheet — S.NO./CODE/NAME wage-per-worker grid plus
 * the ESIC/LWF statutory-contribution footer block. Per-row formulas (not static values) for
 * every derived cell, so opening the file and editing an input (basic salary, working days,
 * OT, advance) recalculates everything downstream exactly like the source workbook does.
 * Returns the TOTAL row number so writeBillSheet can cross-reference it.
 */
function writeWageRegisterSheet(sheet: ExcelJS.Worksheet, data: { companyName: string; monthLabel: string; rows: WageRegisterSheetRow[]; totals: WageRegisterSheetTotals }): number {
  sheet.columns = [
    { width: 6 }, // A S.NO.
    { width: 11 }, // B CODE. No.
    { width: 18 }, // C NAME
    { width: 11 }, // D BASIC SALARY
    { width: 10 }, // E MONTH DAYS
    { width: 11 }, // F WORKING DAYS
    { width: 6 }, // G OT
    { width: 12 }, // H BASIC EARN
    { width: 11 }, // I OT AMOUNT
    { width: 13 }, // J GROSS EARNING
    { width: 9 }, // K PF
    { width: 12 }, // L ESIC DED (0.75%)
    { width: 8 }, // M L.W.F
    { width: 8 }, // N ADV.
    { width: 9 }, // O TOTAL DED.
    { width: 12 }, // P NET PAYABLE
    { width: 11 }, // Q SIGNATURE
  ];
  const LAST_COL = 17;

  const firstDataRow = 3;
  const lastDataRow = firstDataRow + data.rows.length - 1;
  const totalsRowNum = lastDataRow + 1;

  // Title banner — company name reads as the headline, the period as a subordinate line.
  const titleRow = sheet.addRow([]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, LAST_COL);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.value = {
    richText: [
      { font: { bold: true, size: 14 }, text: `${data.companyName}\n` },
      { font: { bold: true, size: 10 }, text: `WAGES FOR THE MONTH OF ${data.monthLabel.toUpperCase()}` },
    ],
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const header = sheet.addRow(["S.NO.", "CODE. No.", "NAME", "BASIC SALARY", "MONTH DAYS", "WORKING DAYS", "OT", "BASIC EARN", "OT AMOUNT", "GROSS EARNING", "PF", "ESIC DED (0.75%)", "L.W.F", "ADV.", "TOTAL DED.", "NET PAYABLE", "SIGNATURE"]);
  header.height = 28;
  header.font = { bold: true, size: 9 };
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
      r.basicSalary,
      r.monthDays,
      r.workingDays,
      r.otHours,
      { formula: `(D${rn}/E${rn})*F${rn}`, result: r.basicEarn },
      { formula: `(D${rn}/E${rn}/8)*G${rn}`, result: r.otAmount },
      { formula: `SUM(H${rn}:I${rn})`, result: r.grossEarning },
      0,
      { formula: `(J${rn}*0.75)/100`, result: r.esic },
      { formula: `(J${rn}*0.2)/100`, result: r.lwf },
      r.advance,
      { formula: `SUM(K${rn}:M${rn})`, result: r.totalDeduction },
      { formula: `(J${rn}-O${rn}-N${rn})`, result: r.netPayable },
      "",
    ]);
    row.font = { size: 9 };
    row.eachCell((cell) => (cell.border = { bottom: THIN_GREY }));
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(17).alignment = { horizontal: "center" };
  });

  const totalsRow = sheet.addRow([
    "",
    "",
    "TOTAL",
    "",
    "",
    { formula: `SUM(F${firstDataRow}:F${lastDataRow})`, result: data.totals.workingDays },
    "",
    { formula: `SUM(H${firstDataRow}:H${lastDataRow})`, result: data.totals.basicEarn },
    { formula: `SUM(I${firstDataRow}:I${lastDataRow})`, result: data.totals.otAmount },
    { formula: `SUM(J${firstDataRow}:J${lastDataRow})`, result: data.totals.grossEarning },
    0,
    { formula: `SUM(L${firstDataRow}:L${lastDataRow})`, result: data.totals.esic },
    { formula: `SUM(M${firstDataRow}:M${lastDataRow})`, result: data.totals.lwf },
    { formula: `SUM(N${firstDataRow}:N${lastDataRow})`, result: data.totals.advance },
    { formula: `SUM(O${firstDataRow}:O${lastDataRow})`, result: data.totals.totalDeduction },
    { formula: `SUM(P${firstDataRow}:P${lastDataRow})`, result: data.totals.netPayable },
    "",
  ]);
  totalsRow.font = { bold: true, size: 10 };
  totalsRow.getCell(6).alignment = { horizontal: "center" };
  totalsRow.eachCell((cell) => (cell.border = { top: MEDIUM_GREY }));

  sheet.addRow([]);

  // ESIC/LWF statutory-contribution summary — TOTAL CONTN. sums the wages figure itself
  // plus both contributions, matching the source workbook's own (slightly unusual) formula.
  const esicWagesRow = totalsRowNum + 2;
  const esicContnRow = esicWagesRow + 1;
  const lwfContnRow = esicContnRow + 1;

  const esicWages = data.totals.grossEarning;
  const employeeEsicContn = round2((esicWages * 0.75) / 100);
  const lwfContn = round2((esicWages * 0.2) / 100);
  const totalContn = round2(esicWages + employeeEsicContn + lwfContn);

  const contnRows: [string, { formula: string; result: number }][] = [
    ["ESIC WAGES", { formula: `J${totalsRowNum}`, result: esicWages }],
    ["EMPLOYEE ESIC CONTN.", { formula: `D${esicWagesRow}*0.75/100`, result: employeeEsicContn }],
    ["L.W.F CONTN.", { formula: `D${esicWagesRow}*0.2/100`, result: lwfContn }],
    ["TOTAL CONTN.", { formula: `SUM(D${esicWagesRow}:D${lwfContnRow})`, result: totalContn }],
  ];
  for (const [label, value] of contnRows) {
    const row = sheet.addRow(["", "", label, value]);
    row.font = { bold: true, size: 10 };
    row.getCell(3).alignment = { horizontal: "left" };
    row.getCell(4).numFmt = MONEY_FORMAT;
    row.getCell(4).alignment = { horizontal: "right" };
  }

  applyMoneyFormat(sheet, ["D", "H", "I", "J", "L", "M", "N", "O", "P"], 2);

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
  earnings: { label: string; amount: number }[];
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

/** A label:value pair — label left-aligned/muted, value left-aligned (never right — right-aligning a value next to a non-blank label risks Excel clipping its leading characters when the value overflows). */
function labelValueCell(row: ExcelJS.Row, labelCol: number, valueCol: number, label: string, value: string | number) {
  row.getCell(labelCol).value = label;
  row.getCell(labelCol).font = { color: MUTED_GREY, size: 10 };
  row.getCell(valueCol).value = value;
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
  addMergedRow(sheet, `PAY SLIP — ${slip.monthLabel.toUpperCase()}`, { bold: true, size: 11 }, 6);
  sheet.addRow([]);

  // Employee Details — label:value pairs in columns A/B and C/D (E/F unused here).
  const detailRows: [string, string, string, string][] = [
    ["Employee Code", slip.employeeCode, "Employee Name", slip.employeeName],
    ["Father / Husband", slip.fatherHusbandName ?? "—", "Department", slip.department],
    ["Designation", slip.designation, "Location", slip.location ?? "—"],
    ["Payment Mode", slip.paymentMode ?? "—", "Bank A/C", slip.bankAccount ? `${slip.bankAccount}${slip.ifsc ? ` (${slip.ifsc})` : ""}` : "—"],
    ["PF No.", slip.pfNo ?? "—", "ESIC No.", slip.esicNo ?? "—"],
    ["UAN", slip.uan ?? "—", "", ""],
  ];
  for (const [label1, value1, label2, value2] of detailRows) {
    const row = sheet.addRow([]);
    labelValueCell(row, 1, 2, label1, value1);
    if (label2) labelValueCell(row, 3, 4, label2, value2);
    row.eachCell((cell) => (cell.border = { bottom: THIN_GREY }));
  }
  sheet.addRow([]);

  // Attendance — label:value pairs in A/B, C/D, E/F.
  const attendanceHeader = sheet.addRow(["Attendance"]);
  sheet.mergeCells(attendanceHeader.number, 1, attendanceHeader.number, 6);
  styleHeaderRow(attendanceHeader);
  const a = slip.attendance;
  const attendanceRows: [string, number, string, number, string, number][] = [
    ["Month Days", a.monthDays, "Present", a.present, "W. Off", a.weekOff],
    ["Holiday", a.holiday, "CL", a.cl, "SL", a.sl],
    ["LWP", a.lwp, "Payable", a.payableDays, "OT (hrs)", a.otHours],
  ];
  for (const [label1, value1, label2, value2, label3, value3] of attendanceRows) {
    const row = sheet.addRow([]);
    labelValueCell(row, 1, 2, label1, value1);
    labelValueCell(row, 3, 4, label2, value2);
    labelValueCell(row, 5, 6, label3, value3);
    row.eachCell((cell, colNumber) => {
      cell.border = { bottom: THIN_GREY };
      if (colNumber % 2 === 0) cell.alignment = { horizontal: "right" };
    });
  }
  sheet.addRow([]);

  const earningsHeader = sheet.addRow(["Allowance", "Amount"]);
  styleHeaderRow(earningsHeader);
  slip.earnings.forEach((l) => {
    const row = sheet.addRow([l.label, l.amount]);
    row.getCell(2).numFmt = MONEY_FORMAT;
    row.getCell(2).alignment = { horizontal: "right" };
  });
  const grossRow = sheet.addRow(["Total", slip.grossEarning]);
  grossRow.font = { bold: true };
  grossRow.getCell(2).numFmt = MONEY_FORMAT;
  grossRow.getCell(2).alignment = { horizontal: "right" };
  grossRow.getCell(1).border = grossRow.getCell(2).border = { top: THIN_GREY };
  sheet.addRow([]);

  const deductionsHeader = sheet.addRow(["Deductions", "Amount"]);
  styleHeaderRow(deductionsHeader);
  slip.deductions.forEach((l) => {
    const row = sheet.addRow([l.label, l.amount]);
    row.getCell(2).numFmt = MONEY_FORMAT;
    row.getCell(2).alignment = { horizontal: "right" };
  });
  const dedRow = sheet.addRow(["Total", slip.totalDeduction]);
  dedRow.font = { bold: true };
  dedRow.getCell(2).numFmt = MONEY_FORMAT;
  dedRow.getCell(2).alignment = { horizontal: "right" };
  dedRow.getCell(1).border = dedRow.getCell(2).border = { top: THIN_GREY };
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
  company: { name: string; address: string; mobile: string | null; gstNo: string | null; pfCode: string | null; esiCode: string | null; bankAccount: string | null; ifsc: string | null; branch: string | null };
  client: { name: string; address: string; gstNo: string | null; panNo: string | null; hsnSac: string | null };
  line: {
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
  };
}

interface WageTableRef {
  sheetName: string;
  totalsRow: number;
}

/**
 * Mirrors the source workbook's "Sheet1" row-for-row. Every derived cell (TOTAL (1)/(2), the
 * ESI/LWF/service-charge percentages, CGST/SGST, GRAND TOTAL) is a live formula. Basic Wages
 * and Incentive Amt link to the wage-register sheet's TOTAL row when `wageRef` is given (the
 * combined workbook); standalone (no wage sheet in the file) they're plain editable inputs.
 */
function writeBillSheet(sheet: ExcelJS.Worksheet, data: BillExportData, wageRef?: WageTableRef) {
  const { company, client, line } = data;
  sheet.columns = [{ width: 26 }, { width: 20 }, { width: 16 }, { width: 16 }];

  const nameRow = sheet.addRow([company.name]);
  sheet.mergeCells(nameRow.number, 1, nameRow.number, 4);
  nameRow.height = 24;
  nameRow.getCell(1).font = { bold: true, size: 16 };
  nameRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const addressRow = sheet.addRow([company.address]);
  sheet.mergeCells(addressRow.number, 1, addressRow.number, 4);
  addressRow.getCell(1).font = { size: 10, color: MUTED_GREY };
  addressRow.getCell(1).alignment = { horizontal: "center", wrapText: true };

  const mobRow = sheet.addRow([`Mob. ${company.mobile ?? ""}`]);
  sheet.mergeCells(mobRow.number, 1, mobRow.number, 4);
  mobRow.getCell(1).font = { size: 10, color: MUTED_GREY };
  mobRow.getCell(1).alignment = { horizontal: "center" };

  const billRow = sheet.addRow([`Bill No: ${data.billNo}`, "", new Date(data.billDate).toLocaleDateString("en-IN")]);
  billRow.font = { size: 11 };
  billRow.getCell(3).alignment = { horizontal: "right" };

  const clientNameRow = sheet.addRow([`M/s ${client.name}`, "", "GST. NO.", client.gstNo ?? ""]);
  clientNameRow.getCell(1).font = { bold: true, size: 12 };
  clientNameRow.getCell(3).font = { size: 10, color: MUTED_GREY };
  clientNameRow.getCell(3).alignment = { horizontal: "right" };
  clientNameRow.getCell(4).font = { bold: true, size: 10 };

  const clientAddrRow = sheet.addRow([client.address, "", "PAN NO.", client.panNo ?? ""]);
  clientAddrRow.height = 28;
  clientAddrRow.getCell(1).font = { size: 10 };
  clientAddrRow.getCell(1).alignment = { wrapText: true };
  clientAddrRow.getCell(3).font = { size: 10, color: MUTED_GREY };
  clientAddrRow.getCell(3).alignment = { horizontal: "right" };
  clientAddrRow.getCell(4).font = { bold: true, size: 10 };

  const pfCodeRow = sheet.addRow(["", "", "PF CODE", company.pfCode ?? ""]);
  pfCodeRow.getCell(3).font = { size: 10, color: MUTED_GREY };
  pfCodeRow.getCell(3).alignment = { horizontal: "right" };
  pfCodeRow.getCell(4).font = { bold: true, size: 10 };

  const gstRow = sheet.addRow([`GST NO :${company.gstNo ?? ""}`, "", "ESI CODE / HSN-SAC", `${company.esiCode ?? ""} ${client.hsnSac ?? ""}`.trim()]);
  gstRow.getCell(1).font = { bold: true, size: 10 };
  gstRow.getCell(3).font = { size: 10, color: MUTED_GREY };
  gstRow.getCell(3).alignment = { horizontal: "right" };
  gstRow.getCell(4).font = { bold: true, size: 10 };

  const titleRow = sheet.addRow([`BILL FOR THE MONTH OF ${data.monthLabel.toUpperCase()}`]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 4);
  titleRow.getCell(1).font = { bold: true, size: 12 };
  titleRow.getCell(1).alignment = { horizontal: "center" };

  const header = sheet.addRow(["PARTICULARS", "ATTENDANCE", "RATE", "AMOUNT"]);
  header.height = 20;
  header.font = { bold: true, size: 10 };
  header.alignment = { horizontal: "center", vertical: "middle" };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: THIN_GREY };
  });
  header.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  const basicWagesRow = sheet.addRow([`Basic Wages (${data.monthLabelShort})`]);
  basicWagesRow.getCell(4).value = wageRef ? { formula: `'${wageRef.sheetName}'!H${wageRef.totalsRow}`, result: line.basicWages } : line.basicWages;
  basicWagesRow.font = { size: 10 };
  const basicWagesRowNum = basicWagesRow.number;

  const hraRow = sheet.addRow(["HRA", "", "", line.hra]);
  hraRow.font = { size: 10 };
  const conRow = sheet.addRow(["CON.", "", "", line.con]);
  conRow.font = { size: 10 };
  const otRow = sheet.addRow(["OT AMOUNT"]);
  otRow.font = { size: 10 };
  const incentiveRow = sheet.addRow(["INCENTIVE AMT."]);
  incentiveRow.getCell(4).value = wageRef ? { formula: `'${wageRef.sheetName}'!I${wageRef.totalsRow}`, result: line.incentiveAmt } : line.incentiveAmt;
  incentiveRow.font = { size: 10 };
  const incentiveRowNum = incentiveRow.number;

  const total1Row = sheet.addRow(["TOTAL (1)"]);
  total1Row.getCell(4).value = { formula: `SUM(D${basicWagesRowNum}:D${incentiveRowNum})`, result: line.total1 };
  total1Row.font = { bold: true, size: 11 };
  total1Row.eachCell((cell) => (cell.border = { top: THIN_GREY }));
  const total1RowNum = total1Row.number;

  const pfRow = sheet.addRow(["PF @12%", "", 0, 0]);
  pfRow.font = { size: 10 };

  const esi325Row = sheet.addRow(["ESI @ 3.25% ON"]);
  esi325Row.getCell(3).value = { formula: `D${total1RowNum}`, result: line.total1 };
  esi325Row.getCell(4).value = { formula: `(C${esi325Row.number}*3.25)/100`, result: line.esiEmployer };
  esi325Row.font = { size: 10 };

  const esi075Row = sheet.addRow(["ESI @ 0.75% ON"]);
  esi075Row.getCell(3).value = { formula: `D${total1RowNum}`, result: line.total1 };
  esi075Row.getCell(4).value = { formula: `(C${esi075Row.number}*0.75)/100`, result: line.esiEmployee };
  esi075Row.font = { size: 10 };

  const lwf1Row = sheet.addRow(["L.W.F @ 0.25% ON"]);
  lwf1Row.getCell(3).value = { formula: `D${total1RowNum}`, result: line.total1 };
  lwf1Row.getCell(4).value = { formula: `(C${lwf1Row.number}*0.25)/100`, result: line.lwf1 };
  lwf1Row.font = { size: 10 };

  const serviceRow = sheet.addRow(["Service charges@7% on"]);
  serviceRow.getCell(3).value = { formula: `D${total1RowNum}`, result: line.total1 };
  serviceRow.getCell(4).value = { formula: `(C${serviceRow.number}*7)/100`, result: line.serviceCharge };
  serviceRow.font = { size: 10 };

  const lwf2Row = sheet.addRow(["Labour Welfare Fund@.2%", "", "Person"]);
  lwf2Row.getCell(4).value = { formula: `((D${basicWagesRowNum}*0.2)/100)*2`, result: line.lwf2 };
  lwf2Row.font = { size: 10 };
  lwf2Row.getCell(3).alignment = { horizontal: "center" };

  const total2Row = sheet.addRow(["TOTAL (2)"]);
  total2Row.getCell(4).value = { formula: `SUM(D${total1RowNum}:D${lwf2Row.number})`, result: line.total2 };
  total2Row.font = { bold: true, size: 11 };
  total2Row.eachCell((cell) => (cell.border = { top: THIN_GREY }));
  const total2RowNum = total2Row.number;

  const cgstRow = sheet.addRow(["CGST @ 9% on"]);
  cgstRow.getCell(3).value = { formula: `D${total2RowNum}`, result: line.total2 };
  cgstRow.getCell(4).value = { formula: `(D${total2RowNum}*9)/100`, result: line.cgst };
  cgstRow.font = { size: 10 };

  const sgstRow = sheet.addRow(["SGST @ 9% on"]);
  sgstRow.getCell(3).value = { formula: `D${total2RowNum}`, result: line.total2 };
  sgstRow.getCell(4).value = { formula: `(D${total2RowNum}*9)/100`, result: line.sgst };
  sgstRow.font = { size: 10 };

  const grandTotalRow = sheet.addRow(["GRAND TOTAL"]);
  grandTotalRow.getCell(4).value = { formula: `SUM(D${total2RowNum}:D${sgstRow.number})`, result: line.grandTotal };
  grandTotalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 13 };
    cell.border = { top: MEDIUM_GREY, bottom: MEDIUM_GREY };
  });

  sheet.addRow([]);
  const wordsRow = sheet.addRow([amountInWords(line.grandTotal)]);
  sheet.mergeCells(wordsRow.number, 1, wordsRow.number, 4);
  wordsRow.getCell(1).font = { bold: true, size: 11 };

  const bankNameRow = sheet.addRow([company.name]);
  bankNameRow.getCell(1).font = { size: 10 };
  const bankAcRow = sheet.addRow([`A/C NO-${company.bankAccount ?? ""}`]);
  bankAcRow.getCell(1).font = { size: 10 };
  const bankIfscRow = sheet.addRow([`${company.ifsc ?? ""}   ${company.branch ?? ""}`]);
  bankIfscRow.getCell(1).font = { size: 10 };

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
  rows: WageRegisterSheetRow[];
  totals: WageRegisterSheetTotals;
  bill: BillExportData;
}

/** One workbook, two sheets — "Wage Register" and "Bill", matching the source workbook's own layout where the bill formula-links to the wage register in the same file. */
export async function downloadWageRegisterWithBill(data: WageRegisterWithBillData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const wageSheetName = "Wage Register";
  const totalsRow = writeWageRegisterSheet(wb.addWorksheet(wageSheetName), { companyName: data.companyName, monthLabel: data.monthLabel, rows: data.rows, totals: data.totals });
  writeBillSheet(wb.addWorksheet("Bill"), data.bill, { sheetName: wageSheetName, totalsRow });
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
