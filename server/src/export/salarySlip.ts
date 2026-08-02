import { renderHtmlToPdf } from "../lib/puppeteer";

export interface SalarySlipLine {
  label: string;
  amount: number;
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
  earnings: SalarySlipLine[];
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

function renderLineRows(lines: SalarySlipLine[]): string {
  return lines.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td class="amount">${formatAmount(l.amount)}</td></tr>`).join("");
}

function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

function renderAttendance(a: SalarySlipAttendance | undefined): string {
  if (!a) return "";
  const cell = (label: string, value: number) => `<div class="a-cell"><span class="a-label">${label}</span><span class="a-value">${value}</span></div>`;
  return `
    <div class="attendance">
      <div class="section-title">Attendance</div>
      <div class="a-grid">
        ${cell("Month Days", a.monthDays)}${cell("Present", a.present)}${cell("W. Off", a.weekOff)}
        ${cell("Holiday", a.holiday)}${cell("CL", a.cl)}${cell("SL", a.sl)}
        ${cell("LWP", a.lwp)}${cell("Payable", a.payableDays)}${cell("OT (hrs)", a.otHours)}
      </div>
    </div>
  `;
}

function renderSlipSection(data: SalarySlipData, isLast: boolean): string {
  const bankAc = data.bankAccount ? `${data.bankAccount}${data.ifsc ? ` (${data.ifsc})` : ""}` : undefined;
  return `
    <section class="slip"${isLast ? "" : ' style="page-break-after: always;"'}>
      <div class="sig-row">
        <span>Authorised Signatory</span>
        <span>Employee's Signature</span>
      </div>
      <header>
        <h1>${escapeHtml(data.companyName)}</h1>
        <p class="address">${escapeHtml(data.companyAddress)}</p>
        ${data.companyGstNo ? `<p class="gst">GSTIN: ${escapeHtml(data.companyGstNo)}</p>` : ""}
        <h2>PAY SLIP — ${escapeHtml(data.monthLabel.toUpperCase())}</h2>
      </header>
      <table class="employee">
        ${detailRow("Employee Code", data.employeeCode)}
        ${detailRow("Employee Name", data.employeeName)}
        ${detailRow("Father / Husband", data.fatherHusbandName)}
        ${detailRow("Department", data.department)}
        ${detailRow("Designation", data.designation)}
        ${detailRow("Location", data.location)}
        ${detailRow("Payment Mode", data.paymentMode)}
        ${detailRow("Bank A/C", bankAc)}
        ${detailRow("PF No.", data.pfNo)}
        ${detailRow("ESIC No.", data.esicNo)}
        ${detailRow("UAN", data.uan)}
      </table>
      ${renderAttendance(data.attendance)}
      <div class="columns">
        <table class="lines">
          <thead><tr><th colspan="2">Allowance</th></tr></thead>
          <tbody>${renderLineRows(data.earnings)}</tbody>
          <tfoot><tr><td>Total</td><td class="amount">${formatAmount(data.grossEarning)}</td></tr></tfoot>
        </table>
        <table class="lines">
          <thead><tr><th colspan="2">Deductions</th></tr></thead>
          <tbody>${renderLineRows(data.deductions)}</tbody>
          <tfoot><tr><td>Total</td><td class="amount">${formatAmount(data.totalDeduction)}</td></tr></tfoot>
        </table>
      </div>
      <table class="net">
        <tr><td>Net Salary</td><td class="amount">${formatAmount(data.netPayable)}</td></tr>
      </table>
      <p class="words">${escapeHtml(amountInWords(data.netPayable))}</p>
      <div class="sig-row sig-row-footer">
        <span>Authorised Signatory</span>
        <span>Employee's Signature</span>
      </div>
    </section>
  `;
}

const STYLES = `
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; margin: 0; }
  .slip { padding: 32px; }
  .sig-row { display: flex; justify-content: space-between; font-size: 10px; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 12px; }
  .sig-row-footer { border-bottom: none; border-top: 1px solid #ddd; margin-top: 16px; padding-top: 6px; margin-bottom: 0; }
  header { text-align: center; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 22px; font-weight: bold; }
  h2 { margin: 6px 0 0; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
  .address { margin: 2px 0 0; font-size: 10px; color: #444; }
  .gst { margin: 2px 0 0; font-size: 10px; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  table.employee { margin-bottom: 14px; }
  table.employee td { padding: 4px 8px; font-size: 11px; border-bottom: 1px solid #eee; }
  table.employee td:first-child { color: #555; width: 140px; }
  .section-title { font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; background: #efece4; padding: 5px 8px; border: 1px solid #ddd; border-bottom: none; }
  .attendance { margin-bottom: 14px; }
  .a-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #ddd; }
  .a-cell { display: flex; justify-content: space-between; padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #eee; }
  .a-label { color: #555; }
  .columns { display: flex; gap: 16px; margin-top: 4px; }
  table.lines { border: 1px solid #ccc; }
  table.lines th { background: #efece4; text-align: left; padding: 6px 8px; border-bottom: 1px solid #ccc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.lines td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  table.lines tfoot td { font-weight: bold; border-top: 1px solid #ccc; border-bottom: none; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; }
  table.net { margin-top: 16px; border: 2px solid #333; }
  table.net td { padding: 8px; font-weight: bold; font-size: 15px; }
  .words { text-align: right; font-size: 10px; font-style: italic; color: #555; margin: 4px 0 0; }
`;

function renderDocumentHtml(slips: SalarySlipData[]): string {
  const body = slips.map((s, i) => renderSlipSection(s, i === slips.length - 1)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>${body}</body></html>`;
}

/** One PDF, one page per slip (page-break-after between sections) — used for both a single slip and a batch download. */
export async function generateSalarySlipsPdf(slips: SalarySlipData[]): Promise<Buffer> {
  if (slips.length === 0) throw new Error("generateSalarySlipsPdf requires at least one slip");
  return renderHtmlToPdf(renderDocumentHtml(slips));
}
