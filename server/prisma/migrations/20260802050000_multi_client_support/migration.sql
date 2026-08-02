-- ContractWorker: add clientId (required — one client per worker).
-- Added nullable first so existing rows can be backfilled before the NOT NULL
-- constraint is applied; every existing worker is assigned to the earliest
-- (currently only) client, matching how they were implicitly billed before
-- multi-client support existed.
ALTER TABLE "ContractWorker" ADD COLUMN "clientId" TEXT;

UPDATE "ContractWorker" SET "clientId" = (SELECT "id" FROM "Client" ORDER BY "createdAt" ASC LIMIT 1) WHERE "clientId" IS NULL;

ALTER TABLE "ContractWorker" ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "ContractWorker" ADD CONSTRAINT "ContractWorker_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PayrollRun: add clientId (nullable — only CONTRACT runs use it, INHOUSE stays null).
-- Existing CONTRACT runs backfilled to the same client as above, for the same reason.
ALTER TABLE "PayrollRun" ADD COLUMN "clientId" TEXT;

UPDATE "PayrollRun" SET "clientId" = (SELECT "id" FROM "Client" ORDER BY "createdAt" ASC LIMIT 1) WHERE "type" = 'CONTRACT';

ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Wage register is now scoped per client per month, not just per month.
DROP INDEX "PayrollRun_month_year_type_key";

CREATE UNIQUE INDEX "PayrollRun_month_year_type_clientId_key" ON "PayrollRun"("month", "year", "type", "clientId");
