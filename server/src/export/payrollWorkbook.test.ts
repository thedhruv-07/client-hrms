import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayrollWorkbook } from "./payrollWorkbook";

const PLACEHOLDERS = {
  COMPANY_NAME: "Lucky Enterprises",
  MONTH_LABEL: "JULY-2026",
  MONTH_LABEL_SHORT: "JULY-26",
  CLIENT_NAME: "Wide India Industries",
  BILL_NO: "006",
  BILL_DATE: "01/08/2026",
};

function formulaOf(cell: { formula?: string }): string | undefined {
  return cell.formula;
}

test("3 workers (matches template row count): formulas and totals stay at row 6", async () => {
  const wb = await buildPayrollWorkbook({
    workers: [
      { code: "CW-001", name: "Arun", basicSalary: 17000, workingDays: 23, otHours: 58, advance: 1000 },
      { code: "CW-002", name: "Biru Kumar", basicSalary: 17000, workingDays: 18, otHours: 51, advance: 5000 },
      { code: "CW-003", name: "Suraj", basicSalary: 17000, workingDays: 3, otHours: 1 },
    ],
    placeholders: PLACEHOLDERS,
  });

  const table1 = wb.getWorksheet("Table 1")!;
  const sheet1 = wb.getWorksheet("Sheet1")!;

  assert.equal(table1.getCell("C3").value, "Arun");
  assert.equal(table1.getCell("D3").value, 17000);
  assert.equal(table1.getCell("M3").value, 1000);
  assert.equal(formulaOf(table1.getCell("G3")), "(D3/30)*E3");
  assert.equal(formulaOf(table1.getCell("O3")), "(I3-N3-M3)");

  assert.equal(formulaOf(table1.getCell("G6")), "SUM(G3:G5)");
  assert.equal(formulaOf(table1.getCell("D8")), "I6");
  assert.equal(formulaOf(sheet1.getCell("E10")), "'Table 1'!G6");
  assert.equal(formulaOf(sheet1.getCell("E14")), "'Table 1'!H6");
});

test("5 workers: extra rows inserted and total-row formulas shift to row 8", async () => {
  const workers = Array.from({ length: 5 }, (_, i) => ({
    code: `CW-${i + 1}`,
    name: `Worker ${i + 1}`,
    basicSalary: 17000,
    workingDays: 20,
    otHours: 10,
  }));

  const wb = await buildPayrollWorkbook({ workers, placeholders: PLACEHOLDERS });
  const table1 = wb.getWorksheet("Table 1")!;
  const sheet1 = wb.getWorksheet("Sheet1")!;

  for (let r = 3; r <= 7; r++) {
    assert.equal(formulaOf(table1.getCell(`G${r}`)), `(D${r}/30)*E${r}`);
    assert.equal(formulaOf(table1.getCell(`O${r}`)), `(I${r}-N${r}-M${r})`);
  }
  assert.equal(table1.getCell("C7").value, "Worker 5");

  assert.equal(formulaOf(table1.getCell("G8")), "SUM(G3:G7)");
  assert.equal(formulaOf(table1.getCell("D8")), "I8");
  assert.equal(formulaOf(sheet1.getCell("E10")), "'Table 1'!G8");
  assert.equal(formulaOf(sheet1.getCell("E14")), "'Table 1'!H8");
});

test("1 worker: template rows spliced down and total-row formulas shift to row 4", async () => {
  const wb = await buildPayrollWorkbook({
    workers: [{ code: "CW-001", name: "Solo", basicSalary: 17000, workingDays: 30, otHours: 0 }],
    placeholders: PLACEHOLDERS,
  });
  const table1 = wb.getWorksheet("Table 1")!;
  const sheet1 = wb.getWorksheet("Sheet1")!;

  assert.equal(table1.getCell("C3").value, "Solo");
  assert.equal(formulaOf(table1.getCell("G4")), "SUM(G3:G3)");
  assert.equal(formulaOf(table1.getCell("D8")), "I4");
  assert.equal(formulaOf(sheet1.getCell("E10")), "'Table 1'!G4");
});

test("placeholders are substituted and none are left over", async () => {
  const wb = await buildPayrollWorkbook({
    workers: [{ code: "CW-001", name: "Arun", basicSalary: 17000, workingDays: 23, otHours: 58 }],
    placeholders: {
      COMPANY_NAME: "Lucky Enterprises",
      MONTH_LABEL: "JULY-2026",
      MONTH_LABEL_SHORT: "JULY-26",
      COMPANY_ADDRESS: "Test address",
      COMPANY_MOBILE: "9999999999",
      COMPANY_GST: "TESTGST",
      COMPANY_PF_CODE: "TESTPF",
      COMPANY_ESI_CODE: "TESTESI",
      COMPANY_BANK_ACCOUNT: "TESTACC",
      COMPANY_IFSC: "TESTIFSC",
      COMPANY_BANK_BRANCH: "TESTBRANCH",
      BILL_NO: "006",
      BILL_DATE: "01/08/2026",
      CLIENT_NAME: "Wide India Industries",
      CLIENT_ADDRESS_LINE1: "Line 1",
      CLIENT_ADDRESS_LINE2: "Line 2",
      CLIENT_GST: "TESTCLIENTGST",
      CLIENT_PAN: "TESTCLIENTPAN",
      AMOUNT_IN_WORDS: "Rs. Test Only.",
    },
  });

  let leftoverTokens = 0;
  wb.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const text = JSON.stringify(cell.value);
        if (text.includes("{{")) leftoverTokens++;
      });
    });
  });

  assert.equal(leftoverTokens, 0);

  const sheet1 = wb.getWorksheet("Sheet1")!;
  assert.equal(sheet1.getCell("B4").value, "M/s Wide India Industries");
});
