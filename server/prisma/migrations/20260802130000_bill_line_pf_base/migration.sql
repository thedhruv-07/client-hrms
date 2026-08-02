-- The EPF-wage-ceiling-capped basic that pfEmployer's 13% is computed on,
-- shown as the PF row's own "Chargeable Amount" on the printed invoice
-- (distinct from Sub Total, which the ESIC and Service Charge rows use).
ALTER TABLE "BillLine" ADD COLUMN "pfBase" DECIMAL(12,2) NOT NULL DEFAULT 0;
