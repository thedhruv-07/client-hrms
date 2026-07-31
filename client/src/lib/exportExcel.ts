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

export interface SalarySlipExportData {
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  monthLabel: string;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

function writeSlipSheet(sheet: ExcelJS.Worksheet, slip: SalarySlipExportData) {
  sheet.columns = [{ width: 22 }, { width: 18 }];
  sheet.addRow(["Employee", `${slip.employeeName} (${slip.employeeCode})`]);
  sheet.addRow(["Department", slip.department]);
  sheet.addRow(["Designation", slip.designation]);
  sheet.addRow(["Month", slip.monthLabel]);
  sheet.addRow([]);

  const earningsHeader = sheet.addRow(["Earnings", "Amount"]);
  styleHeaderRow(earningsHeader);
  slip.earnings.forEach((l) => sheet.addRow([l.label, l.amount]));
  const grossRow = sheet.addRow(["Gross Earning", slip.grossEarning]);
  grossRow.font = { bold: true };
  sheet.addRow([]);

  const deductionsHeader = sheet.addRow(["Deductions", "Amount"]);
  styleHeaderRow(deductionsHeader);
  slip.deductions.forEach((l) => sheet.addRow([l.label, l.amount]));
  const dedRow = sheet.addRow(["Total Deduction", slip.totalDeduction]);
  dedRow.font = { bold: true };
  sheet.addRow([]);

  const netRow = sheet.addRow(["Net Payable", slip.netPayable]);
  netRow.font = { bold: true, size: 12 };

  sheet.getColumn(2).numFmt = MONEY_FORMAT;
  sheet.getColumn(2).alignment = { horizontal: "right" };
}

export async function downloadSalarySlip(slip: SalarySlipExportData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  writeSlipSheet(wb.addWorksheet("Salary Slip"), slip);
  await downloadWorkbook(wb, `salary-slip-${slip.employeeCode}-${slip.monthLabel.toLowerCase()}.xlsx`);
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
