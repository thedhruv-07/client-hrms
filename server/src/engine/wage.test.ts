import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateWageLine, sumWageLines } from "./wage";

// Fixtures from the real source workbook, Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx
// (SALARY SHEET + OT Calculation, worker 4646 "YOGESH", a 30-day June:
// 12 present days + 3 week-off/holiday = 15 paid days).

test("YOGESH (basic 15221, 12 present + 3 week-off, 13 OT hrs, no HRA/incentive/award)", () => {
  const r = calculateWageLine({ basicSalary: 15221, monthDays: 30, actualPresentDays: 12, weekOffHoliday: 3, otHours: 13 });
  assert.equal(r.workingDays, 15);
  assert.equal(r.basicEarn, 7611); // 7610.5 rounded to the nearest whole rupee
  assert.equal(r.hraEarn, 0);
  assert.equal(r.otAmount, 1649); // basic/30/8*13*2 = 1648.94 — double rate
  assert.equal(r.incentive, 0);
  assert.equal(r.grossWagesErnd, 7611);
  assert.equal(r.pf, 913); // ROUND(min(7610.5,15000)*12%, 0)
  assert.equal(r.esic, 58); // ROUNDUP(7610.5*0.75%, 0)
  assert.equal(r.employerEsic, 248); // ROUNDUP(7610.5*3.25%, 0)
  assert.equal(r.otEsic, 13); // ROUNDUP(1648.94*0.75%, 0)
  assert.equal(r.lwf, 16); // below 17500 threshold: ROUNDUP(7610.5*0.2%, 0)
  assert.equal(r.totalDeduction, 1000); // 913+58+16+13
});

test("PRAKASH (basic 19426, 11 paid days, 46 OT hrs, incentive allow rate 1000)", () => {
  const r = calculateWageLine({ basicSalary: 19426, monthDays: 30, actualPresentDays: 11, weekOffHoliday: 0, otHours: 46, incentiveAllowRate: 1000 });
  assert.equal(r.otAmount, 7447); // 19426/30/8*46*2 = 7446.63 -> nearest rupee
  assert.equal(r.incentive, 367); // 1000/30*11 = 366.67 -> nearest rupee
});

test("TA/Medical/CEA earn prorated the same way as basic; Misc rounds to the rupee at the per-worker cell", () => {
  const r = calculateWageLine({
    basicSalary: 15000,
    ta: 1000,
    medicalAllow: 500,
    cea: 300,
    miscAllow: 777,
    monthDays: 30,
    actualPresentDays: 15,
    weekOffHoliday: 0,
    otHours: 0,
  });
  assert.equal(r.taEarn, 500);
  assert.equal(r.medicalEarn, 250);
  assert.equal(r.ceaEarn, 150);
  assert.equal(r.miscEarn, Math.round((777 / 30) * 15)); // 388.5 -> 389 (rounds up at .5)
  assert.equal(r.grossWagesErnd, 7500 + 500 + 250 + 150 + r.miscEarn);
});

test("Welfare uses a flat 35 once gross wages earned reach 17500, not the 0.2% rate", () => {
  const r = calculateWageLine({ basicSalary: 30000, monthDays: 30, actualPresentDays: 30, weekOffHoliday: 0, otHours: 0 });
  assert.equal(r.grossWagesErnd, 30000);
  assert.equal(r.lwf, 35);
});

test("PF caps at the 15000 wage ceiling even when basic earned exceeds it", () => {
  const r = calculateWageLine({ basicSalary: 34000, monthDays: 30, actualPresentDays: 30, weekOffHoliday: 0, otHours: 0 });
  assert.equal(r.basicEarn, 34000);
  assert.equal(r.pf, 1800); // 12% of the capped 15000, not of 34000
});

test("Night Allowance and Overtime Arrear feed the OT stream's gross/net, not the regular stream", () => {
  const r = calculateWageLine({
    basicSalary: 15000,
    monthDays: 30,
    actualPresentDays: 15,
    weekOffHoliday: 0,
    otHours: 0,
    nightAllowance: 500,
    otArrear: 200,
  });
  // otGrossPayable = 0(ot) + 500(night) + 0(award) + 0(incentive) = 500; + 200 arrear = 700
  assert.equal(r.otEsic, Math.ceil(700 * 0.0075));
  assert.equal(r.grossEarning, r.grossWagesErnd + 700);
});

test("TDS and Other Deduction reduce net payable; Leave Encashment/Arrears/Bonus increase it", () => {
  const base = calculateWageLine({ basicSalary: 15000, monthDays: 30, actualPresentDays: 15, weekOffHoliday: 0, otHours: 0 });
  const withExtras = calculateWageLine({
    basicSalary: 15000,
    monthDays: 30,
    actualPresentDays: 15,
    weekOffHoliday: 0,
    otHours: 0,
    tds: 100,
    otherDeduction: 50,
    leaveEncashment: 300,
    arrears: 200,
    bonus: 400,
  });
  assert.equal(withExtras.totalDeduction, base.totalDeduction + 150);
  assert.equal(withExtras.netPayable, round0(base.netPayable - 150 + 300 + 200 + 400));
});

test("zero attendance and zero OT hours nets to zero minus any advance", () => {
  const r = calculateWageLine({ basicSalary: 17000, monthDays: 30, actualPresentDays: 0, weekOffHoliday: 0, otHours: 0, advance: 500 });
  assert.equal(r.basicEarn, 0);
  assert.equal(r.otAmount, 0);
  assert.equal(r.grossEarning, 0);
  assert.equal(r.esic, 0);
  assert.equal(r.otEsic, 0);
  assert.equal(r.lwf, 0);
  assert.equal(r.netPayable, -500);
});

test("a 31-day month pays a lower per-day rate than a 30-day month for the same working days", () => {
  const thirtyDayMonth = calculateWageLine({ basicSalary: 17000, monthDays: 30, actualPresentDays: 23, weekOffHoliday: 0, otHours: 0 });
  const thirtyOneDayMonth = calculateWageLine({ basicSalary: 17000, monthDays: 31, actualPresentDays: 23, weekOffHoliday: 0, otHours: 0 });
  assert.ok(thirtyOneDayMonth.basicEarn < thirtyDayMonth.basicEarn);
});

test("register totals: earned figures sum raw per-worker values, deductions sum already-rounded per-worker values", () => {
  const inputs = [
    { basicSalary: 15221, monthDays: 30, actualPresentDays: 12, weekOffHoliday: 3, otHours: 13 },
    { basicSalary: 19426, monthDays: 30, actualPresentDays: 11, weekOffHoliday: 0, otHours: 46, incentiveAllowRate: 1000 },
  ];
  const totals = sumWageLines(inputs);
  const [a, b] = inputs.map((i) => calculateWageLine(i));
  assert.equal(totals.totalDeduction, round0(a!.totalDeduction + b!.totalDeduction));
  assert.equal(totals.basicEarn, round0((15221 / 30) * 15 + (19426 / 30) * 11));
});

function round0(n: number): number {
  return Math.round(n);
}
