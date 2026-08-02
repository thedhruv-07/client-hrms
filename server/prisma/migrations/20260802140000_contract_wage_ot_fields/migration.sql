-- Adds HRA (a real per-worker rate, not the bill's old always-zero manual
-- field) and the OT-Calculation stream's own per-worker inputs: incentive
-- allowance rate (prorated into `incentive`), attendance award, and the
-- separate ESIC deduction on that OT/incentive/attendance stream.

ALTER TABLE "ContractWorker" ADD COLUMN "hra" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "PayrollLine"
  ADD COLUMN "hraEarn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "incentiveAllowRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "attendAward" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "otEsic" DECIMAL(12,2) NOT NULL DEFAULT 0;
