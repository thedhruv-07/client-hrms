import ExcelJS from "exceljs";
import path from "node:path";
import type { WageInput } from "../engine/wage";

const TEMPLATE_PATH = path.join(__dirname, "..", "..", "templates", "wage-bill-template.xlsx");

const FIRST_WORKER_ROW = 3;
const TEMPLATE_LAST_WORKER_ROW = 5; // "Table 1" ships with 3 example worker rows (3-5)
const TEMPLATE_WORKER_ROW_COUNT = TEMPLATE_LAST_WORKER_ROW - FIRST_WORKER_ROW + 1;

export interface WorkerRow extends WageInput {
  code: string;
  name: string;
}

export interface PayrollWorkbookInput {
  workers: WorkerRow[];
  /**
   * Fills the template's {{TOKEN}} placeholders — see
   * templates/wage-bill-template.xlsx for the full set: COMPANY_NAME,
   * COMPANY_ADDRESS, COMPANY_MOBILE, COMPANY_GST, COMPANY_PF_CODE,
   * COMPANY_ESI_CODE, COMPANY_BANK_ACCOUNT, COMPANY_IFSC,
   * COMPANY_BANK_BRANCH, MONTH_LABEL, MONTH_LABEL_SHORT, BILL_NO,
   * BILL_DATE, CLIENT_NAME, CLIENT_ADDRESS_LINE1, CLIENT_ADDRESS_LINE2,
   * CLIENT_GST, CLIENT_PAN, AMOUNT_IN_WORDS. Any token left out of this
   * map is left as literal "{{TOKEN}}" text in the output.
   */
  placeholders: Record<string, string>;
  /** Sheet1 E11, manual entry, defaults to 0. */
  hra?: number;
  /** Sheet1 E12, manual entry, defaults to 0. */
  con?: number;
}

function applyTokens(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? values[key]! : match));
}

function substituteCell(cell: ExcelJS.Cell, values: Record<string, string>): void {
  const v = cell.value;
  if (v && typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    let changed = false;
    for (const run of v.richText) {
      const replaced = applyTokens(run.text, values);
      if (replaced !== run.text) {
        run.text = replaced;
        changed = true;
      }
    }
    if (changed) cell.value = v;
  } else if (typeof v === "string") {
    const replaced = applyTokens(v, values);
    if (replaced !== v) cell.value = replaced;
  }
}

function substituteWorkbook(wb: ExcelJS.Workbook, values: Record<string, string>): void {
  wb.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => substituteCell(cell, values));
    });
  });
}

/**
 * Clones the wage-bill template and writes one payroll run into it. Every
 * formula is written explicitly per row rather than relying on ExcelJS to
 * translate them when rows are duplicated/spliced — it copies formula
 * strings literally, so a duplicated row 6 would still say "=SUM(G3:H3)".
 */
export async function buildPayrollWorkbook(input: PayrollWorkbookInput): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);

  const table1 = wb.getWorksheet("Table 1");
  const sheet1 = wb.getWorksheet("Sheet1");
  if (!table1 || !sheet1) throw new Error("Template is missing an expected sheet");

  const workerCount = input.workers.length;

  if (workerCount > TEMPLATE_WORKER_ROW_COUNT) {
    table1.duplicateRow(TEMPLATE_LAST_WORKER_ROW, workerCount - TEMPLATE_WORKER_ROW_COUNT, true);
  } else if (workerCount < TEMPLATE_WORKER_ROW_COUNT) {
    table1.spliceRows(FIRST_WORKER_ROW + workerCount, TEMPLATE_WORKER_ROW_COUNT - workerCount);
  }

  const lastWorkerRow = FIRST_WORKER_ROW + workerCount - 1;
  const totalRow = FIRST_WORKER_ROW + workerCount;

  input.workers.forEach((worker, i) => {
    const r = FIRST_WORKER_ROW + i;
    table1.getCell(`A${r}`).value = i + 1;
    table1.getCell(`B${r}`).value = worker.code;
    table1.getCell(`C${r}`).value = worker.name;
    table1.getCell(`D${r}`).value = worker.basicSalary;
    table1.getCell(`E${r}`).value = worker.workingDays;
    table1.getCell(`F${r}`).value = worker.otHours;
    table1.getCell(`G${r}`).value = { formula: `(D${r}/30)*E${r}` };
    table1.getCell(`H${r}`).value = { formula: `(D${r}/30/8)*F${r}` };
    table1.getCell(`I${r}`).value = { formula: `SUM(G${r}:H${r})` };
    table1.getCell(`J${r}`).value = worker.pf ?? 0;
    table1.getCell(`K${r}`).value = { formula: `(I${r}*0.75)/100` };
    table1.getCell(`L${r}`).value = { formula: `(I${r}*0.2)/100` };
    table1.getCell(`M${r}`).value = worker.advance ?? 0;
    table1.getCell(`N${r}`).value = { formula: `SUM(J${r}:L${r})` };
    table1.getCell(`O${r}`).value = { formula: `(I${r}-N${r}-M${r})` };
  });

  const sumCol = (col: string) => `SUM(${col}${FIRST_WORKER_ROW}:${col}${lastWorkerRow})`;
  table1.getCell(`E${totalRow}`).value = { formula: sumCol("E") };
  table1.getCell(`G${totalRow}`).value = { formula: sumCol("G") };
  table1.getCell(`H${totalRow}`).value = { formula: sumCol("H") };
  table1.getCell(`I${totalRow}`).value = { formula: sumCol("I") };
  table1.getCell(`J${totalRow}`).value = 0;
  table1.getCell(`K${totalRow}`).value = { formula: sumCol("K") };
  table1.getCell(`L${totalRow}`).value = { formula: sumCol("L") };
  table1.getCell(`M${totalRow}`).value = { formula: sumCol("M") };
  table1.getCell(`N${totalRow}`).value = { formula: sumCol("N") };
  table1.getCell(`O${totalRow}`).value = { formula: sumCol("O") };

  table1.getCell("D8").value = { formula: `I${totalRow}` };

  sheet1.getCell("E10").value = { formula: `'Table 1'!G${totalRow}` };
  sheet1.getCell("E14").value = { formula: `'Table 1'!H${totalRow}` };
  sheet1.getCell("E11").value = input.hra ?? 0;
  sheet1.getCell("E12").value = input.con ?? 0;

  substituteWorkbook(wb, input.placeholders);

  return wb;
}
