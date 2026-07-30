import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateWageLine, sumWageLines } from "./wage";

// Baseline figures from PROJECT_SPEC.md section 7 (the real source workbook).
// Basic salary of 17,000 for all three is back-solved from Gross Earning:
// I = (D/30) * (E + F/8), so D = Gross*30 / (E + F/8).

test("Arun (23 days, 58 OT hrs)", () => {
  const r = calculateWageLine({ basicSalary: 17000, workingDays: 23, otHours: 58, advance: 1000 });
  assert.equal(r.grossEarning, 17141.67);
  assert.equal(r.totalDeduction, 162.85);
  assert.equal(r.netPayable, 15978.82);
});

test("Biru Kumar (18 days, 51 OT hrs, adv. 5000)", () => {
  const r = calculateWageLine({ basicSalary: 17000, workingDays: 18, otHours: 51, advance: 5000 });
  assert.equal(r.grossEarning, 13812.50);
  assert.equal(r.totalDeduction, 131.22);
  assert.equal(r.netPayable, 8681.28);
});

test("Suraj (3 days, 1 OT hr)", () => {
  const r = calculateWageLine({ basicSalary: 17000, workingDays: 3, otHours: 1 });
  assert.equal(r.grossEarning, 1770.83);
  assert.equal(r.totalDeduction, 16.82);
  assert.equal(r.netPayable, 1754.01);
});

test("PF defaults to 0 when not supplied", () => {
  const r = calculateWageLine({ basicSalary: 17000, workingDays: 23, otHours: 58 });
  assert.equal(r.pf, 0);
});

test("register totals match the sheet's row-6 column totals", () => {
  const lines = [
    calculateWageLine({ basicSalary: 17000, workingDays: 23, otHours: 58, advance: 1000 }),
    calculateWageLine({ basicSalary: 17000, workingDays: 18, otHours: 51, advance: 5000 }),
    calculateWageLine({ basicSalary: 17000, workingDays: 3, otHours: 1 }),
  ];
  const totals = sumWageLines(lines);
  assert.equal(totals.grossEarning, 32725.00);
  assert.equal(totals.totalDeduction, 310.89);
  assert.equal(totals.netPayable, 26414.11);
});
