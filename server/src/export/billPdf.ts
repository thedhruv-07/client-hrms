import { renderHtmlToPdf } from "../lib/puppeteer";

export interface BillPdfLine {
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
}

export interface BillPdfData {
  companyName: string;
  companyAddress: string;
  companyMobile?: string | null;
  companyEmail?: string | null;
  companyGstNo?: string | null;
  companyPanNo?: string | null;
  companyPfCode?: string | null;
  companyEsiCode?: string | null;
  clientName: string;
  clientAddress: string;
  clientGstNo?: string | null;
  clientPanNo?: string | null;
  clientHsnSac?: string | null;
  billNo: string;
  billDate: string;
  monthLabel: string;
  line: BillPdfLine;
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

function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<div class="d-row"><span class="d-label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function chargeRow(sr: number | null, label: string, rate: string, chargeable: string, amount: string): string {
  return `<tr><td class="sr">${sr ?? ""}</td><td>${label}</td><td class="amount">${rate}</td><td class="amount">${chargeable}</td><td class="amount">${amount}</td></tr>`;
}

function renderDocumentHtml(data: BillPdfData): string {
  const { line } = data;
  const rows = [
    chargeRow(1, "BASIC", "", "", formatAmount(line.basicWages)),
    chargeRow(2, "HRA", "", "", formatAmount(line.hra)),
    chargeRow(3, "OT AMOUNT", "", "", formatAmount(line.otAmount)),
    chargeRow(4, "ATTEND. AWARD", "", "", formatAmount(line.attendAward)),
    chargeRow(5, "INCENTIVE AMT.", "", "", formatAmount(line.incentiveAmt)),
  ].join("");

  const reimbursementRows = [
    chargeRow(null, "Sub Total", "", "", formatAmount(line.total1)),
    chargeRow(null, "REIMBURSEMENT OF EMPLOYER'S SHARE OF ESIC CONTRIBUTION", "3.25 %", formatAmount(line.total1), formatAmount(line.esiEmployer)),
    chargeRow(null, "REIMBURSEMENT OF EMPLOYER'S SHARE OF PF CONTRIBUTION", "13.00 %", formatAmount(line.pfBase), formatAmount(line.pfEmployer)),
    chargeRow(null, "REIMBURSEMENT OF LABOUR WELFARE FUND", "", "", formatAmount(line.lwf)),
    chargeRow(null, "SERVICE CHARGES", "5.00 %", formatAmount(line.total1), formatAmount(line.serviceCharge)),
  ].join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>
    <section class="invoice">
      <header>
        <h1>${escapeHtml(data.companyName)}</h1>
        <p class="address">${escapeHtml(data.companyAddress)}</p>
        ${data.companyMobile || data.companyEmail ? `<p class="contact">${[data.companyMobile ? `Mob. ${escapeHtml(data.companyMobile)}` : "", data.companyEmail ? `Email: ${escapeHtml(data.companyEmail)}` : ""].filter(Boolean).join(" | ")}</p>` : ""}
        <div class="codes">
          ${data.companyGstNo ? `<span>GST No.: ${escapeHtml(data.companyGstNo)}</span>` : ""}
          ${data.companyPanNo ? `<span>PAN No.: ${escapeHtml(data.companyPanNo)}</span>` : ""}
          ${data.companyPfCode ? `<span>PF Code: ${escapeHtml(data.companyPfCode)}</span>` : ""}
          ${data.companyEsiCode ? `<span>ESIC Code: ${escapeHtml(data.companyEsiCode)}</span>` : ""}
        </div>
        <h2>TAX INVOICE</h2>
      </header>

      <div class="meta">
        <div class="party">
          <div class="section-title">Party Name &amp; Address</div>
          <p class="party-name">${escapeHtml(data.clientName)}</p>
          <p>${escapeHtml(data.clientAddress)}</p>
          ${detailRow("GST No.", data.clientGstNo)}
          ${detailRow("PAN No.", data.clientPanNo)}
          ${detailRow("HSN/SAC", data.clientHsnSac)}
        </div>
        <div class="invoice-info">
          ${detailRow("Invoice No.", data.billNo)}
          ${detailRow("Date", new Date(data.billDate).toLocaleDateString("en-IN"))}
          ${detailRow("Bill for the Month", data.monthLabel)}
        </div>
      </div>

      <table class="lines">
        <thead>
          <tr><th>Sr</th><th>Description / Chargeable Heads</th><th class="amount">Rate</th><th class="amount">Chargeable Amount</th><th class="amount">Amount Rs.</th></tr>
        </thead>
        <tbody>
          <tr class="section-row"><td colspan="5">MANPOWER SUPPLY FOR ${escapeHtml(data.monthLabel.toUpperCase())}</td></tr>
          ${rows}
          ${reimbursementRows}
          <tr class="taxable-row"><td colspan="4">Taxable Amount</td><td class="amount">${formatAmount(line.total2)}</td></tr>
          ${chargeRow(null, "SGST", "9.00 %", formatAmount(line.total2), formatAmount(line.sgst))}
          ${chargeRow(null, "CGST", "9.00 %", formatAmount(line.total2), formatAmount(line.cgst))}
          <tr class="grand-row"><td colspan="4">Grand Total</td><td class="amount">${formatAmount(line.grandTotal)}</td></tr>
        </tbody>
      </table>

      <p class="words">Amount In Words: ${escapeHtml(amountInWords(line.grandTotal))}</p>

      <p class="disclaimer">E &amp; O.E. Bill may please be paid within 5 days from the date of receipt. Interest @ 2% per month will be charged if payment is not made within due period.</p>

      <div class="sig-row">
        <span>Receiver's Signature</span>
        <span>For ${escapeHtml(data.companyName)} — Auth. Signatory</span>
      </div>
    </section>
  </body></html>`;
}

const STYLES = `
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; margin: 0; }
  .invoice { padding: 28px; }
  header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  h1 { margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
  h2 { margin: 8px 0 0; font-size: 13px; font-weight: bold; letter-spacing: 1px; }
  .address { margin: 2px 0 0; font-size: 10px; color: #444; }
  .contact { margin: 2px 0 0; font-size: 10px; color: #444; }
  .codes { display: flex; justify-content: center; gap: 16px; margin-top: 4px; font-size: 10px; color: #444; }
  .meta { display: flex; gap: 16px; margin: 14px 0; }
  .party, .invoice-info { flex: 1; border: 1px solid #ccc; padding: 8px; }
  .section-title { font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .party-name { font-weight: bold; margin: 0 0 2px; }
  .party p { margin: 2px 0; }
  .d-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ddd; }
  .d-label { color: #555; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.lines th { background: #efece4; text-align: left; padding: 6px 8px; border: 1px solid #ccc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.lines td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  .sr { width: 24px; text-align: center; color: #666; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .section-row td { background: #f7f5f0; font-weight: bold; font-size: 10px; }
  .taxable-row td, .grand-row td { font-weight: bold; border-top: 2px solid #333; }
  .grand-row td { font-size: 13px; }
  .words { text-align: right; font-size: 10px; font-style: italic; color: #555; margin: 10px 0 0; }
  .disclaimer { font-size: 9px; color: #666; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 6px; }
  .sig-row { display: flex; justify-content: space-between; font-size: 10px; margin-top: 40px; }
`;

export async function generateBillPdf(data: BillPdfData): Promise<Buffer> {
  return renderHtmlToPdf(renderDocumentHtml(data));
}
