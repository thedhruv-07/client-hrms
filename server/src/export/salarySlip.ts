import puppeteer from "puppeteer-core";
import fs from "node:fs";

export interface SalarySlipLine {
  label: string;
  amount: number;
}

export interface SalarySlipData {
  companyName: string;
  companyAddress: string;
  monthLabel: string;
  employeeName: string;
  employeeCode: string;
  /** In-house only. */
  department?: string;
  /** In-house only. */
  designation?: string;
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

function renderLineRows(lines: SalarySlipLine[]): string {
  return lines
    .map((l) => `<tr><td>${escapeHtml(l.label)}</td><td class="amount">${formatAmount(l.amount)}</td></tr>`)
    .join("");
}

function renderSlipSection(data: SalarySlipData, isLast: boolean): string {
  const subtitle = [data.designation, data.department]
    .filter((v): v is string => Boolean(v))
    .map(escapeHtml)
    .join(", ");
  return `
    <section class="slip"${isLast ? "" : ' style="page-break-after: always;"'}>
      <header>
        <h1>${escapeHtml(data.companyName)}</h1>
        <p class="address">${escapeHtml(data.companyAddress)}</p>
        <h2>Salary Slip — ${escapeHtml(data.monthLabel)}</h2>
      </header>
      <table class="employee">
        <tr><td>Employee</td><td>${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})</td></tr>
        ${subtitle ? `<tr><td>Role</td><td>${subtitle}</td></tr>` : ""}
      </table>
      <div class="columns">
        <table class="lines">
          <thead><tr><th colspan="2">Earnings</th></tr></thead>
          <tbody>${renderLineRows(data.earnings)}</tbody>
          <tfoot><tr><td>Gross Earning</td><td class="amount">${formatAmount(data.grossEarning)}</td></tr></tfoot>
        </table>
        <table class="lines">
          <thead><tr><th colspan="2">Deductions</th></tr></thead>
          <tbody>${renderLineRows(data.deductions)}</tbody>
          <tfoot><tr><td>Total Deduction</td><td class="amount">${formatAmount(data.totalDeduction)}</td></tr></tfoot>
        </table>
      </div>
      <table class="net">
        <tr><td>Net Payable</td><td class="amount">${formatAmount(data.netPayable)}</td></tr>
      </table>
    </section>
  `;
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; }
  .slip { padding: 32px; }
  header { text-align: center; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 20px; }
  h2 { margin: 4px 0 0; font-size: 14px; font-weight: normal; }
  .address { margin: 2px 0 0; font-size: 11px; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  table.employee td { padding: 4px 0; }
  table.employee td:first-child { color: #555; width: 100px; }
  .columns { display: flex; gap: 16px; margin-top: 16px; }
  table.lines { border: 1px solid #ccc; }
  table.lines th { background: #f2f2f2; text-align: left; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  table.lines td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  table.lines tfoot td { font-weight: bold; border-top: 1px solid #ccc; border-bottom: none; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; }
  table.net { margin-top: 16px; border: 1px solid #333; }
  table.net td { padding: 8px; font-weight: bold; font-size: 14px; }
`;

function renderDocumentHtml(slips: SalarySlipData[]): string {
  const body = slips.map((s, i) => renderSlipSection(s, i === slips.length - 1)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>${body}</body></html>`;
}

function resolveChromePath(): string {
  const fromEnv = process.env["PUPPETEER_EXECUTABLE_PATH"];
  if (fromEnv) return fromEnv;

  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      "No Chrome/Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium binary."
    );
  }
  return found;
}

/** One PDF, one page per slip (page-break-after between sections) — used for both a single slip and a batch download. */
export async function generateSalarySlipsPdf(slips: SalarySlipData[]): Promise<Buffer> {
  if (slips.length === 0) throw new Error("generateSalarySlipsPdf requires at least one slip");

  const browser = await puppeteer.launch({ executablePath: resolveChromePath(), headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(renderDocumentHtml(slips), { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
