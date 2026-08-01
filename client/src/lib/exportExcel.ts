import ExcelJS from "exceljs";

const MONEY_FORMAT = "#,##0.00";

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E5DD" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD8DCD3" } } };
  });
}

function applyMoneyFormat(sheet: ExcelJS.Worksheet, keys: string[]) {
  for (const key of keys) {
    const col = sheet.getColumn(key);
    col.numFmt = MONEY_FORMAT;
    col.alignment = { horizontal: "right" };
  }
}

export interface WageRegisterRow {
  code: string;
  name: string;
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

export interface WageRegisterTotals {
  basicEarn: number;
  otAmount: number;
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

export async function downloadWageRegister(params: { monthLabel: string; rows: WageRegisterRow[]; totals: WageRegisterTotals }): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Wage Register");
  sheet.columns = [
    { header: "Code", key: "code", width: 12 },
    { header: "Name", key: "name", width: 24 },
    { header: "Working Days", key: "workingDays", width: 14 },
    { header: "OT Hours", key: "otHours", width: 12 },
    { header: "Basic Earn", key: "basicEarn", width: 14 },
    { header: "OT Amount", key: "otAmount", width: 14 },
    { header: "Gross Earning", key: "grossEarning", width: 16 },
    { header: "ESIC", key: "esic", width: 12 },
    { header: "LWF", key: "lwf", width: 12 },
    { header: "Advance", key: "advance", width: 12 },
    { header: "Total Deduction", key: "totalDeduction", width: 16 },
    { header: "Net Payable", key: "netPayable", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));
  params.rows.forEach((r) => sheet.addRow(r));
  const totalsRow = sheet.addRow({ code: "", name: "TOTAL", basicEarn: params.totals.basicEarn, otAmount: params.totals.otAmount, grossEarning: params.totals.grossEarning, totalDeduction: params.totals.totalDeduction, netPayable: params.totals.netPayable });
  totalsRow.font = { bold: true };
  totalsRow.border = { top: { style: "thin", color: { argb: "FFD8DCD3" } } };
  applyMoneyFormat(sheet, ["basicEarn", "otAmount", "grossEarning", "esic", "lwf", "advance", "totalDeduction", "netPayable"]);

  await downloadWorkbook(wb, `wage-register-${params.monthLabel.toLowerCase()}.xlsx`);
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

/** Mirrors server/templates/wage-bill-template.xlsx "Sheet1" row-for-row, with computed values instead of formulas. */
export async function downloadBill(data: BillExportData): Promise<void> {
  const { company, client, line } = data;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Bill");
  sheet.columns = [{ width: 24 }, { width: 18 }, { width: 14 }, { width: 14 }];

  const bold = (row: ExcelJS.Row) => (row.font = { bold: true });

  bold(sheet.addRow([company.name]));
  sheet.addRow([company.address]);
  sheet.addRow([`Mob. ${company.mobile ?? ""}`]);
  sheet.addRow([`Bill No: ${data.billNo}`, "", new Date(data.billDate).toLocaleDateString("en-IN")]);
  sheet.addRow([`M/s ${client.name}`, "", "GST. NO.", client.gstNo ?? ""]);
  sheet.addRow([client.address, "", "PAN NO.", client.panNo ?? ""]);
  sheet.addRow(["", "", "PF CODE", company.pfCode ?? ""]);
  sheet.addRow([`GST NO :${company.gstNo ?? ""}`, "", "ESI CODE / HSN-SAC", `${company.esiCode ?? ""} ${client.hsnSac ?? ""}`.trim()]);
  bold(sheet.addRow([`FOR THE MONTH OF ${data.monthLabel}`]));

  const header = sheet.addRow(["PARTICULARS", "ATTENDANCE", "RATE", "AMOUNT"]);
  styleHeaderRow(header);

  sheet.addRow([`Basic Wages (${data.monthLabelShort})`, "", "", line.basicWages]);
  sheet.addRow(["HRA", "", "", line.hra]);
  sheet.addRow(["CON.", "", "", line.con]);
  sheet.addRow(["OT AMOUNT"]);
  sheet.addRow(["INCENTIVE AMT.", "", "", line.incentiveAmt]);
  bold(sheet.addRow(["TOTAL (1)", "", "", line.total1]));
  sheet.addRow(["PF @12%", "", 0, 0]);
  sheet.addRow(["ESI @ 3.25% ON", "", line.total1, line.esiEmployer]);
  sheet.addRow(["ESI @ 0.75% ON", "", line.total1, line.esiEmployee]);
  sheet.addRow(["L.W.F @ 0.25% ON", "", line.total1, line.lwf1]);
  sheet.addRow(["Service charges@7% on", "", line.total1, line.serviceCharge]);
  sheet.addRow(["Labour Welfare Fund@.2%", "", "Person", line.lwf2]);
  bold(sheet.addRow(["TOTAL (2)", "", "", line.total2]));
  sheet.addRow(["CGST @ 9% on", "", line.total2, line.cgst]);
  sheet.addRow(["SGST @ 9% on", "", line.total2, line.sgst]);
  bold(sheet.addRow(["GRAND TOTAL", "", "", line.grandTotal]));

  sheet.addRow([]);
  sheet.addRow([amountInWords(line.grandTotal)]);
  sheet.addRow([company.name]);
  sheet.addRow([`A/C NO-${company.bankAccount ?? ""}`]);
  sheet.addRow([`${company.ifsc ?? ""}   ${company.branch ?? ""}`]);

  applyMoneyFormat(sheet, ["C", "D"]);

  await downloadWorkbook(wb, `bill-${data.billNo}-${data.monthLabel.toLowerCase()}.xlsx`);
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
