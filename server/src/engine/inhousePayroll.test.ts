import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateInHouseWageLine, sumInHouseWageLines } from "./inhousePayroll";

test("above ESIC threshold (gross > 21000): no ESIC deducted", () => {
  const r = calculateInHouseWageLine({ basicSalary: 30000 });
  assert.equal(r.grossEarning, 30000);
  assert.equal(r.pf, 3600);
  assert.equal(r.esic, 0);
  assert.equal(r.lwf, 60);
  assert.equal(r.totalDeduction, 3660);
  assert.equal(r.netPayable, 26340);
});

test("below ESIC threshold with unpaid leave and a bonus", () => {
  const r = calculateInHouseWageLine({ basicSalary: 15000, unpaidLeaveDays: 2, bonus: 1000 });
  assert.equal(r.leaveDeduction, 1000); // (15000/30) * 2
  assert.equal(r.grossEarning, 15000); // 15000 - 1000 + 1000
  assert.equal(r.pf, 1800); // 15000 * 12%, on basic not gross
  assert.equal(r.esic, 112.5); // gross <= 21000
  assert.equal(r.lwf, 30);
  assert.equal(r.totalDeduction, 1942.5);
  assert.equal(r.netPayable, 13057.5);
});

test("advance is subtracted from net but not from totalDeduction", () => {
  const r = calculateInHouseWageLine({ basicSalary: 30000, advance: 2000 });
  assert.equal(r.totalDeduction, 3660); // unchanged from the no-advance case
  assert.equal(r.netPayable, 30000 - 3660 - 2000);
});

test("gross exactly at the ESIC threshold (21000) still gets ESIC — condition is <=, not <", () => {
  const r = calculateInHouseWageLine({ basicSalary: 21000 });
  assert.equal(r.grossEarning, 21000);
  assert.equal(r.esic, 157.5); // 21000 * 0.75%
});

test("one paisa above the ESIC threshold gets no ESIC", () => {
  const r = calculateInHouseWageLine({ basicSalary: 21000, bonus: 0.01 });
  assert.equal(r.grossEarning, 21000.01);
  assert.equal(r.esic, 0);
});

test("zero basic salary and no other inputs nets to zero", () => {
  const r = calculateInHouseWageLine({ basicSalary: 0 });
  assert.equal(r.grossEarning, 0);
  assert.equal(r.pf, 0);
  assert.equal(r.esic, 0);
  assert.equal(r.lwf, 0);
  assert.equal(r.netPayable, 0);
});

test("register totals recompute at full precision before rounding", () => {
  const totals = sumInHouseWageLines([
    { basicSalary: 30000 },
    { basicSalary: 15000, unpaidLeaveDays: 2, bonus: 1000 },
  ]);
  assert.equal(totals.grossEarning, 45000);
  assert.equal(totals.totalDeduction, 3660 + 1942.5);
  assert.equal(totals.netPayable, 26340 + 13057.5);
});
