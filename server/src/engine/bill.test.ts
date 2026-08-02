import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBill } from "./bill";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// End-to-end reproduction of the real "BILL CALCULATION" sheet in
// Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx (June 2026, no worker's basic
// earn exceeded the 15000 PF ceiling that month, so pfBase = basicWages).
test("bill reproduces the real BILL CALCULATION sheet's Sub Total through Grand Total", () => {
  // Split across several workers, each under the 15000 PF ceiling, matching
  // the real month where no individual worker's basic earn triggered the cap.
  const bill = calculateBill({
    workerBasicEarnings: [10000, 10000, 10000, 10000, 10000, 10000, 10823.38333333333],
    workerHraEarnings: [2140.0666666666666],
    otAmount: 74929.48749999999,
    incentiveAmt: 5061,
    lwf: 306, // 2x the wage register's own Welfare-employee total of 153
  });

  assert.equal(bill.total1, round2(152953.9375)); // Sub Total
  assert.equal(bill.esiEmployer, 4972); // ROUNDUP(152953.94*3.25%, 0)
  assert.equal(bill.pfEmployer, round2(70823.38333333333 * 0.13)); // 13% of pfBase (uncapped this month)
  assert.equal(bill.serviceCharge, round2(152953.9375 * 0.05));
  assert.equal(bill.lwf, 306);
  // total2/grandTotal land a paisa above Excel's arbitrary-precision sum
  // (175086.674.../206602.275...) because each line here is stored/rounded
  // to 2 decimals before summing, unlike Excel's unrounded intermediate
  // cells — the same display-vs-underlying-value quirk noted throughout
  // this codebase's wage/bill engines.
  assert.equal(bill.total2, 175086.68); // Taxable Amount
  assert.equal(bill.cgst, round2(15757.80067875));
  assert.equal(bill.sgst, round2(15757.80067875));
  assert.equal(bill.grandTotal, 206602.28);
});

test("PF reimbursement is capped at the EPF wage ceiling per worker, not the raw basic total", () => {
  const bill = calculateBill({ workerBasicEarnings: [17000, 17000], otAmount: 0 });
  // Each worker's basic (17000) exceeds the 15000 ceiling, so PF base is 15000*2 = 30000, not 34000.
  assert.equal(bill.pfBase, 30000);
  assert.equal(bill.pfEmployer, 3900); // 13% of 30000
});

test("ESIC rounds up even a fractional paisa, unlike PF/Service Charge/GST", () => {
  // total1 = 100 -> 3.25% = 3.25 exactly, still rounds up to 4 per ROUNDUP semantics on any positive remainder...
  // use a value that produces a genuine fractional remainder instead:
  const bill = calculateBill({ workerBasicEarnings: [101], otAmount: 0 });
  assert.equal(bill.esiEmployer, Math.ceil(101 * 0.0325));
});

test("HRA, Attendance Award, and Incentive Amt default to 0 when not supplied", () => {
  const bill = calculateBill({ workerBasicEarnings: [1000], otAmount: 0 });
  assert.equal(bill.hra, 0);
  assert.equal(bill.attendAward, 0);
  assert.equal(bill.incentiveAmt, 0);
  assert.equal(bill.lwf, 0);
});

test("all-zero input nets to an all-zero bill", () => {
  const bill = calculateBill({ workerBasicEarnings: [], otAmount: 0 });
  assert.equal(bill.total1, 0);
  assert.equal(bill.esiEmployer, 0);
  assert.equal(bill.pfEmployer, 0);
  assert.equal(bill.serviceCharge, 0);
  assert.equal(bill.total2, 0);
  assert.equal(bill.grandTotal, 0);
});
