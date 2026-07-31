/**
 * Mirrors the rates baked into server/src/engine/*.ts. Displayed in forms
 * as read-only hints — changing these here does nothing; they're informational.
 */
export const CONTRACT_ESIC_RATE = 0.75; // % of gross earning
export const CONTRACT_LWF_RATE = 0.2; // % of gross earning

/** In-house rates are generic India-payroll defaults, not confirmed business policy — see server/src/engine/inhousePayroll.ts. */
export const INHOUSE_PF_RATE = 12; // % of basic salary
export const INHOUSE_ESIC_RATE = 0.75; // % of gross, only when gross <= threshold
export const INHOUSE_ESIC_GROSS_THRESHOLD = 21000;
export const INHOUSE_LWF_RATE = 0.2; // % of gross

export const BILL_ESI_EMPLOYER_RATE = 3.25; // % of Total(1)
export const BILL_ESI_EMPLOYEE_RATE = 0.75; // % of Total(1)
export const BILL_LWF_RATE = 0.25; // % of Total(1)
export const BILL_SERVICE_CHARGE_RATE = 7; // % of Total(1)
export const BILL_CGST_RATE = 9; // % of Total(2)
export const BILL_SGST_RATE = 9; // % of Total(2)
