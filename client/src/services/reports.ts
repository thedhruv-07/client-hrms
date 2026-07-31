export interface ReportDefinition {
  slug: string;
  title: string;
  description: string;
}

/** Matches server/src/routes/reports.ts exactly — /reports/{slug}. Only the shell is built here; each links to a "coming soon" state. */
export const reportDefinitions: ReportDefinition[] = [
  { slug: "wage-register", title: "Wage Register", description: "Per contract payroll run, worker-by-worker gross/deductions/net." },
  { slug: "bill-register", title: "Client Bill Register", description: "Bills issued per client per period, with GST breakdown." },
  { slug: "statutory-contributions", title: "Statutory Contributions", description: "PF/ESIC/LWF totals, contract vs in-house, for filing." },
  { slug: "contract-worker-history", title: "Contract Worker Payment History", description: "One worker's net pay and advances across every run." },
  { slug: "advances", title: "Outstanding Advances", description: "Advances given this period, contract and in-house." },
  { slug: "inhouse-payroll-summary", title: "In-House Payroll Summary", description: "Gross/deduction/bonus/incentive/net totals per run." },
  { slug: "department-cost", title: "Department-wise Salary Cost", description: "In-house salary cost grouped by department." },
  { slug: "employee-history", title: "Employee Payment History", description: "One employee's net pay across every run." },
  { slug: "gst-summary", title: "GST Summary", description: "CGST/SGST collected across bills in a period." },
  { slug: "audit-log", title: "Audit Log", description: "Who changed what, when." },
];
