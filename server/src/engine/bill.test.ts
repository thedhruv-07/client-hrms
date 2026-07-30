import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBill } from "./bill";
import { sumWageLines } from "./wage";

// Baseline fixture from PROJECT_SPEC.md sections 2 and 7 — same month's
// wage register feeds this bill; known Grand Total is 43,077.43.
const WAGE_INPUTS = [
  { basicSalary: 17000, workingDays: 23, otHours: 58, advance: 1000 },
  { basicSalary: 17000, workingDays: 18, otHours: 51, advance: 5000 },
  { basicSalary: 17000, workingDays: 3, otHours: 1 },
];

test("bill reproduces the known Grand Total end-to-end from wage-register totals", () => {
  const wageTotals = sumWageLines(WAGE_INPUTS);
  const bill = calculateBill({
    basicWages: wageTotals.basicEarn,
    incentiveAmt: wageTotals.otAmount,
  });

  assert.equal(bill.total1, 32725.00);
  assert.equal(bill.esiEmployer, 1063.56);
  assert.equal(bill.esiEmployee, 245.44);
  assert.equal(bill.lwf1, 81.81);
  assert.equal(bill.serviceCharge, 2290.75);
  assert.equal(bill.lwf2, 99.73);
  // total2 = SUM(total1, esiEmployer, esiEmployee, lwf1, serviceCharge, lwf2)
  // computed from the raw (unrounded) line values, not their rounded
  // displays — 36506.29582 rounds to 36506.30, one paisa above what summing
  // the already-rounded lines (1063.56+245.44+81.81+2290.75+99.73+32725.00
  // = 36506.29) would give. Same Excel display-vs-underlying-value quirk as
  // the wage register's OT total.
  assert.equal(bill.total2, 36506.30);
  assert.equal(bill.cgst, 3285.57);
  assert.equal(bill.sgst, 3285.57);
  assert.equal(bill.grandTotal, 43077.43);
});

test("HRA and CON default to 0 when not supplied", () => {
  const bill = calculateBill({ basicWages: 1000, incentiveAmt: 0 });
  assert.equal(bill.hra, 0);
  assert.equal(bill.con, 0);
});

test("lwf2 is based on basicWages alone, not total1", () => {
  const bill = calculateBill({ basicWages: 1000, hra: 500, incentiveAmt: 0 });
  // total1 = 1500, but lwf2 = (1000 * 0.2 / 100) * 2 = 4, not based on 1500
  assert.equal(bill.lwf2, 4);
});

test("all-zero input nets to an all-zero bill", () => {
  const bill = calculateBill({ basicWages: 0, incentiveAmt: 0 });
  assert.equal(bill.total1, 0);
  assert.equal(bill.esiEmployer, 0);
  assert.equal(bill.serviceCharge, 0);
  assert.equal(bill.lwf2, 0);
  assert.equal(bill.total2, 0);
  assert.equal(bill.grandTotal, 0);
});
