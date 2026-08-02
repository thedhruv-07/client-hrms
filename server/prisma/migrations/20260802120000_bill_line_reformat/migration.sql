-- Reformat BillLine to match the real tax-invoice line items: OT and
-- Attendance Award become their own lines (previously OT was folded into
-- incentiveAmt), a PF reimbursement line is added, and the two LWF calcs
-- collapse into a single flat LWF amount.

ALTER TABLE "BillLine"
  ADD COLUMN "otAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "attendAward" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lwf" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- incentiveAmt used to actually hold the OT total — move it over before the
-- column is repurposed to mean a real (currently always-zero) incentive.
UPDATE "BillLine" SET "otAmount" = "incentiveAmt", "incentiveAmt" = 0;

-- con -> attendAward
UPDATE "BillLine" SET "attendAward" = "con";

ALTER TABLE "BillLine"
  DROP COLUMN "con",
  DROP COLUMN "esiEmployee",
  DROP COLUMN "lwf1",
  DROP COLUMN "lwf2";
