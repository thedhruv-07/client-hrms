import { renderHtmlToPdf } from "../lib/puppeteer";

export interface SalarySlipLine {
  label: string;
  amount: number;
}

/** Allowance rows show the flat monthly rate alongside the attendance-prorated payable amount, matching the source payslip's two-column layout. */
export interface SalarySlipEarningLine {
  label: string;
  rate: number;
  payable: number;
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

export interface SalarySlipData {
  companyName: string;
  companyAddress: string;
  companyGstNo?: string | null;
  monthLabel: string;
  employeeName: string;
  employeeCode: string;
  fatherHusbandName?: string | null;
  /** In-house only. */
  department?: string | null;
  /** In-house only. */
  designation?: string | null;
  location?: string | null;
  paymentMode?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  pfNo?: string | null;
  esicNo?: string | null;
  uan?: string | null;
  attendance?: SalarySlipAttendance;
  earnings: SalarySlipEarningLine[];
  deductions: SalarySlipLine[];
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

/** Indian numbering (crore/lakh/thousand), whole rupees only. Verbatim copy of client/src/lib/exportExcel.ts's amountInWords. */
function amountInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "Rupees Zero Only.";
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
  return `Rupees ${parts.join(" ")} Only.`;
}

/** "Label : value" combined text, one per populated field — matches the source payslip's inline-colon style. Blank fields are skipped entirely. */
function employeeDetailRows(data: SalarySlipData): string[] {
  const bankAc = data.bankAccount ? `${data.bankAccount}${data.ifsc ? ` (${data.ifsc})` : ""}` : undefined;
  const rows: [string, string | null | undefined][] = [
    ["Employee Code", data.employeeCode],
    ["Employee Name", data.employeeName],
    ["Father / Husband", data.fatherHusbandName],
    ["Department", data.department],
    ["Designation", data.designation],
    ["Payment Mode", data.paymentMode],
    ["A/C No.", bankAc],
    ["ESI No.", data.esicNo],
    ["UAN", data.uan],
    ["Location", data.location],
  ];
  return rows.filter(([, value]) => !!value).map(([label, value]) => `${escapeHtml(label)} : ${escapeHtml(value!)}`);
}

function attendanceRows(a: SalarySlipAttendance | undefined): string[] {
  if (!a) return [];
  return [
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
}

function deductionRows(lines: SalarySlipLine[]): string[] {
  return lines.map((l) => `${escapeHtml(l.label)} : ${formatAmount(l.amount)}`);
}

/**
 * The source payslip is one grid — Employee Details, Attendance, Allowance/Payable, and
 * Deductions all run as parallel columns sharing the same rows, not stacked sections.
 * Every row is always shown (no zero-hiding) in both full-page and compact mode; only the
 * font size changes between them via the ".compact" CSS variables.
 */
function renderSlipSection(data: SalarySlipData, compact: boolean): string {
  const emp = employeeDetailRows(data);
  const att = attendanceRows(data.attendance);
  const ded = deductionRows(data.deductions);
  const earn = data.earnings;
  const maxRows = Math.max(emp.length, att.length, earn.length, ded.length);

  const bodyRows: string[] = [];
  for (let i = 0; i < maxRows; i++) {
    const e = earn[i];
    bodyRows.push(
      `<tr><td>${emp[i] ?? ""}</td><td>${att[i] ?? ""}</td><td>${e ? escapeHtml(e.label) : ""}</td>` +
        `<td class="amount">${e ? formatAmount(e.rate) : ""}</td><td class="amount">${e ? formatAmount(e.payable) : ""}</td>` +
        `<td>${ded[i] ?? ""}</td></tr>`
    );
  }
  const rateTotal = earn.reduce((sum, l) => sum + l.rate, 0);
  bodyRows.push(
    `<tr class="totals"><td></td><td></td><td>Total :</td><td class="amount">${formatAmount(rateTotal)}</td>` +
      `<td class="amount">${formatAmount(data.grossEarning)}</td><td class="amount">${formatAmount(data.totalDeduction)}</td></tr>`
  );

  const sigRowTop = compact
    ? ""
    : `<div class="sig-row"><span>Authorised Signatory</span><span>Employee's Signature</span></div>`;

  return `
    <section class="slip">
      ${sigRowTop}
      <header>
        <div class="header-top">
          <div>
            <h1>${escapeHtml(data.companyName)}</h1>
            <p class="address">${escapeHtml(data.companyAddress)}</p>
            ${data.companyGstNo ? `<p class="gst">GSTIN: ${escapeHtml(data.companyGstNo)}</p>` : ""}
          </div>
          <span class="payslip-tag">Pay Slip</span>
        </div>
        <h2>Payslip For The Month Of : ${escapeHtml(data.monthLabel)}</h2>
      </header>
      <table class="grid">
        <thead>
          <tr>
            <th>Employee Details</th>
            <th>Attendance</th>
            <th colspan="2">Allowance</th>
            <th class="amount">Payable</th>
            <th>Deductions</th>
          </tr>
        </thead>
        <tbody>${bodyRows.join("")}</tbody>
      </table>
      <div class="net-row">
        <span>NET SALARY : ${formatAmount(data.netPayable)}</span>
        <span class="words-inline">${escapeHtml(amountInWords(data.netPayable))}</span>
      </div>
      <div class="sig-row sig-row-footer">
        <span>Authorised Signatory</span>
        <span>Employee's Signature</span>
      </div>
    </section>
  `;
}

// Sizes are CSS variables so ".compact" (N slips stacked on one A4 page) can override
// them all at once instead of duplicating every rule at two font scales.
const STYLES = `
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  @page { size: A4; margin: 0; }
  :root {
    --pad: 32px; --gap-sm: 4px; --gap-md: 8px; --gap-lg: 16px;
    --fs-h1: 22px; --fs-h2: 13px; --fs-sub: 10px; --fs-body: 11px; --fs-net: 15px;
    --row-pad: 4px 8px; --cell-pad: 5px 8px;
  }
  .page.compact {
    --pad: 5mm; --gap-sm: 2px; --gap-md: 4px; --gap-lg: 6px;
    --fs-h1: 15px; --fs-h2: 9.5px; --fs-sub: 7.5px; --fs-body: 8px; --fs-net: 11px;
    --row-pad: 1.5px 5px; --cell-pad: 2px 5px;
  }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; margin: 0; line-height: 1.05; }
  .page.compact { line-height: 1; }
  .page { width: 210mm; }
  .page.compact { height: 297mm; display: flex; flex-direction: column; }
  .slip { padding: var(--pad); font-size: var(--fs-body); }
  .page.compact .slip { flex: 1 1 0; min-height: 0; overflow: hidden; border-bottom: 1px dashed #999; }
  .page.compact .slip:last-child { border-bottom: none; }
  .sig-row { display: flex; justify-content: space-between; font-size: var(--fs-sub); color: #666; border-bottom: 1px solid #ddd; padding-bottom: var(--gap-sm); margin-bottom: var(--gap-md); }
  .sig-row-footer { border-bottom: none; border-top: 1px solid #ddd; margin-top: var(--gap-lg); padding-top: var(--gap-sm); margin-bottom: 0; }
  header { text-align: center; margin-bottom: var(--gap-md); }
  .header-top { display: flex; justify-content: center; align-items: flex-start; position: relative; }
  .payslip-tag { position: absolute; right: 0; top: 0; font-size: var(--fs-sub); font-weight: bold; border: 1px solid #999; border-radius: 2px; padding: 0 4px; }
  h1 { margin: 0; font-size: var(--fs-h1); font-weight: bold; }
  h2 { margin: var(--gap-sm) 0 0; font-size: var(--fs-h2); font-weight: bold; letter-spacing: 0.5px; text-align: right; }
  .address { margin: 1px 0 0; font-size: var(--fs-sub); color: #444; }
  .gst { margin: 1px 0 0; font-size: var(--fs-sub); color: #444; }
  table { width: 100%; border-collapse: collapse; }
  table.grid { border: 1px solid #999; }
  table.grid th { background: #efece4; text-align: left; padding: var(--cell-pad); border: 1px solid #999; font-size: var(--fs-sub); text-transform: uppercase; letter-spacing: 0.5px; }
  table.grid th.amount { text-align: right; }
  table.grid td { padding: var(--row-pad); border-right: 1px solid #ddd; border-bottom: 1px solid #eee; font-size: var(--fs-body); white-space: nowrap; }
  table.grid td:last-child { border-right: none; }
  table.grid tr.totals td { font-weight: bold; border-top: 1px solid #999; }
  table.grid td:nth-child(1) { width: 27%; }
  table.grid td:nth-child(2) { width: 18%; }
  table.grid td:nth-child(3) { width: 11%; }
  table.grid td:nth-child(4), table.grid td:nth-child(5) { width: 9%; }
  table.grid td:nth-child(6) { width: 18%; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; }
  .net-row { display: flex; justify-content: space-between; align-items: baseline; gap: var(--gap-md); margin-top: var(--gap-md); border: 2px solid #333; padding: var(--gap-sm) var(--gap-md); font-weight: bold; font-size: var(--fs-net); }
  .words-inline { font-weight: normal; font-style: italic; font-size: var(--fs-sub); color: #555; white-space: nowrap; }
`;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

function renderDocumentHtml(slips: SalarySlipData[], slipsPerPage: number): string {
  const compact = slipsPerPage > 1;
  const pages = chunk(slips, slipsPerPage);
  const pageClass = compact ? "page compact" : "page";
  const body = pages
    .map(
      (page, i) =>
        `<div class="${pageClass}"${i === pages.length - 1 ? "" : ' style="page-break-after: always;"'}>${page.map((s) => renderSlipSection(s, compact)).join("")}</div>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>${body}</body></html>`;
}

/**
 * One PDF, `slipsPerPage` slips stacked per A4 page (default 1 — one slip, one page).
 * Used for single-slip downloads, one-per-page batches, and the compact bulk-print layout.
 */
export async function generateSalarySlipsPdf(slips: SalarySlipData[], options?: { slipsPerPage?: number }): Promise<Buffer> {
  if (slips.length === 0) throw new Error("generateSalarySlipsPdf requires at least one slip");
  const slipsPerPage = Math.max(1, Math.floor(options?.slipsPerPage ?? 1));
  return renderHtmlToPdf(renderDocumentHtml(slips, slipsPerPage));
}
