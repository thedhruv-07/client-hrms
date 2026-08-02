-- Full column parity with Omp_Wages_Overtime_Sheet_JUNE_2026.xlsx: worker
-- details (Father Name, Category, Designation) plus the remaining allowance
-- rates (TA, Medical, CEA, Misc), and every remaining per-period column on
-- both the SALARY SHEET and OT Calculation sheet.

ALTER TABLE "ContractWorker"
  ADD COLUMN "fatherHusbandName" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "designation" TEXT,
  ADD COLUMN "ta" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "medicalAllow" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cea" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "miscAllow" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "PayrollLine"
  ADD COLUMN "actualPresentDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "weekOffHoliday" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taEarn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "medicalEarn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "ceaEarn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "miscEarn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "nightCount" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "nightAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "otArrear" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employerEsic" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "otherDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "leaveEncashment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "arrears" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill actualPresentDays from the existing workingDays so historical
-- rows still reconcile (workingDays = actualPresentDays + weekOffHoliday).
UPDATE "PayrollLine" SET "actualPresentDays" = "workingDays" WHERE "contractWorkerId" IS NOT NULL;
