import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSalarySlipsPdf, type SalarySlipData } from "./salarySlip";

const ARUN: SalarySlipData = {
  companyName: "Lucky Enterprises",
  companyAddress: "Test address",
  monthLabel: "JUNE 2026",
  employeeName: "Arun",
  employeeCode: "CW-001",
  earnings: [
    { label: "Basic Earn", amount: 13033.33 },
    { label: "OT Amount", amount: 4108.33 },
  ],
  deductions: [
    { label: "ESIC", amount: 128.56 },
    { label: "LWF", amount: 34.28 },
    { label: "Advance", amount: 1000 },
  ],
  grossEarning: 17141.67,
  totalDeduction: 162.85,
  netPayable: 15978.82,
};

function pageCount(pdf: Buffer): number | undefined {
  const match = pdf.toString("latin1").match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
  return match?.[1] !== undefined ? Number(match[1]) : undefined;
}

test("generates a valid single-page PDF for one slip", async () => {
  const pdf = await generateSalarySlipsPdf([ARUN]);
  assert.ok(pdf.length > 1000, "PDF should be non-trivially sized");
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(pageCount(pdf), 1);
});

test("batch of slips produces one page per slip", async () => {
  const suraj: SalarySlipData = {
    ...ARUN,
    employeeName: "Suraj",
    employeeCode: "CW-003",
    grossEarning: 1770.83,
    totalDeduction: 16.82,
    netPayable: 1754.01,
  };
  const pdf = await generateSalarySlipsPdf([ARUN, suraj]);
  assert.equal(pageCount(pdf), 2);
});

test("rejects an empty slip list instead of launching a browser for nothing", async () => {
  await assert.rejects(() => generateSalarySlipsPdf([]));
});
