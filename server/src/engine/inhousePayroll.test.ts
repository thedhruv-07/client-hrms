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
  assert.equal(r.esic, 113); // gross <= 21000; 112.5 rounds to the nearest rupee
  assert.equal(r.lwf, 30);
  assert.equal(r.totalDeduction, 1943); // 1942.5 rounds to the nearest rupee
  assert.equal(r.netPayable, 13058); // 13057.5 rounds to the nearest rupee
});

test("advance is subtracted from net but not from totalDeduction", () => {
  const r = calculateInHouseWageLine({ basicSalary: 30000, advance: 2000 });
  assert.equal(r.totalDeduction, 3660); // unchanged from the no-advance case
  assert.equal(r.netPayable, 30000 - 3660 - 2000);
});

test("gross exactly at the ESIC threshold (21000) still gets ESIC — condition is <=, not <", () => {
  const r = calculateInHouseWageLine({ basicSalary: 21000 });
  assert.equal(r.grossEarning, 21000);
  assert.equal(r.esic, 158); // 21000 * 0.75% = 157.5, rounds to the nearest rupee
});

test("one paisa above the ESIC threshold gets no ESIC", () => {
  const r = calculateInHouseWageLine({ basicSalary: 21000, bonus: 0.01 });
  assert.equal(r.grossEarning, 21000); // 21000.01 rounds to the nearest rupee for display...
  assert.equal(r.esic, 0); // ...but the raw (pre-rounding) gross is still used for the threshold check
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
  assert.equal(totals.totalDeduction, 5603); // 3660 + 1942.5 = 5602.5, rounds to the nearest rupee
  assert.equal(totals.netPayable, 39398); // 26340 + 13057.5 = 39397.5, rounds to the nearest rupee
});
