# Payroll & Contract-Labour Billing System — Project Brief

> Drop this file into the repo root (as `CLAUDE.md` or `PROJECT_SPEC.md`) so a fresh Claude Code
> session has full context without re-deriving it.

## 1. Scope (confirmed)

Two connected modules, not one:

1. **Contract Labour Billing** — models the actual source workbook: a labour contractor
   (e.g. "Lucky Enterprises") pays daily-wage workers, then bills a client company
   (e.g. "Wide India Industries") monthly, adding statutory contributions, a service
   margin, and GST.
2. **In-House Employee Payroll** — standard salaried-employee payroll (the feature list
   in the original spec: employee master with PF/ESIC/UAN/bank details, department
   dashboards, leave/bonus/incentive handling, etc.)

Both share the same statutory-deduction primitives (PF, ESIC, LWF) and the same
Excel/PDF export pipeline, but have distinct data models — a contract worker has no
department/designation hierarchy or leave balance; an in-house employee isn't billed
to a third party with GST.

## 2. Source-of-truth workbook analysis

File: `SALARY_SHEET_JUNE-26_WITH_BILL.xlsx` — 2 sheets, no macros, no named ranges,
no data validation, no conditional formatting.

### Sheet "Table 1" — Wage Register (`A1:Q11`, col Q hidden/empty — ignore)

| Cell(s) | Purpose | Formula |
|---|---|---|
| `A1:Q1` (merged) | Company name + "WAGES FOR THE MONTH OF `<MONTH-YEAR>`" | static text |
| Row 2 | Headers | S.NO, CODE No., NAME, BASIC SALARY, WORKING DAYS, OT, BASIC EARN, OT AMOUNT, GROSS EARNING, PF, ESIC DED (0.75%), L.W.F, ADV., TOTAL DED., NET PAYABLE, SIGNATURE |
| Rows 3–5 | One row per worker | — |
| `G{r} =(D{r}/30)*E{r}` | Basic Earn | Basic Salary ÷ 30 × Working Days |
| `H{r} =(D{r}/30/8)*F{r}` | OT Amount | Basic Salary ÷ 30 ÷ 8 (hourly rate) × OT hours |
| `I{r} =SUM(G{r}:H{r})` | Gross Earning | |
| `J{r}` | PF | **hard-coded value, not a formula** — currently `0` for every worker |
| `K{r} =(I{r}*0.75)/100` | ESIC deduction | employee share, 0.75% of gross |
| `L{r} =(I{r}*0.2)/100` | LWF deduction | 0.2% of gross |
| `M{r}` | Advance | manual entry, not derived |
| `N{r} =SUM(J{r}:L{r})` | Total Deduction | PF + ESIC + LWF |
| `O{r} =(I{r}-N{r}-M{r})` | Net Payable | Gross − Total Ded − Advance |
| Row 6 | Column totals | `SUM()` per column |
| `D8 =I6` | ESIC Wages | = Gross Earning total |
| `D9 =D8*0.75/100` | Employee ESIC Contribution | |
| `D10 =D8*0.2/100` | LWF Contribution | |
| `D11 =SUM(D8:D10)` | Total Contribution | |

### Sheet "Sheet1" — Client GST Bill (`A1:G26`)

Header block (rows 1–7, several merged cells: `C3:D3`, `C10:C14`, `D10:D14`,
`D16:D21`) holds contractor address/mobile, bill no/date, client name & address,
GST No., PAN No., PF Code, ESI Code/HSN-SAC.

| Cell | Formula | Note |
|---|---|---|
| `E10 ='Table 1'!G6` | Basic Wages | pulls Basic Earn total from wage sheet |
| `E11`, `E12` | HRA, CON. | manual, currently `0` |
| `E14 ='Table 1'!H6` | labeled **"INCENTIVE AMT."** | **actually pulls the OT total** — naming mismatch inherited from the source template, decide whether to relabel or keep as-is for continuity with client-facing bills already issued |
| `E15 =SUM(E10:E14)` | Total (1) | |
| `E17 =(C17*3.25)/100` | ESI @ 3.25% | employer contribution, billed to client |
| `E18 =(C18*0.75)/100` | ESI @ 0.75% | employee share, mirrors wage-sheet deduction |
| `E19 =(C19*0.25)/100` | LWF @ 0.25% on Total(1) | |
| `E20 =(C20*7)/100` | **Service charge @ 7%** | contractor's actual margin — this is the profit line |
| `E21 =((E10*0.2)/100)*2` | LWF @ 0.2% "per person" ×2 | a **second, differently-based** LWF calc — not a duplicate of `E19`, has its own base and ×2 multiplier |
| `E22 =SUM(E15:E21)` | Total (2) | |
| `E23`, `E24 =(E22*9)/100` | CGST / SGST @ 9% each | |
| `E25 =SUM(E22:E24)` | Grand Total | |
| `B26` | amount in words + bank A/C + IFSC + branch | static text, regenerated per bill |

### Formatting reality (preserve deliberately, don't "clean up" silently)
- Fonts are inconsistent cell-to-cell in the original — Times New Roman, Calibri,
  Comic Sans MS, Cambria, Verdana all appear on the same sheet. If exports need to
  visually match bills already sent to this client, keep it as-is; if we're
  standardizing for the new system, pick one professional font and confirm the
  choice explicitly before it's baked into every future export.
- No print area / page setup defined — Excel's defaults apply.
- Row heights are irregular (15–80px), driven by wrapped multi-line text, not a
  deliberate print layout.

### Open decisions before building the payroll engine
1. Is PF genuinely always 0 for contract workers, or was it just unused this month?
   If PF ever applies, we need the actual rate/rule — nothing in the sheet defines it.
2. Keep or fix the "INCENTIVE AMT." / OT-total mislabel on the bill?
3. Is the `E21` "LWF ×2 per person" formula intentional business logic (e.g. employer
   + employee LWF combined) or a copy-paste leftover? Confirm before encoding it as a rule.

## 3. Tech stack (as specified)

- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui + React Hook Form + TanStack Table + React Query
- **Backend:** Node.js + Express + Prisma ORM
- **DB:** PostgreSQL
- **Auth:** JWT + RBAC (Admin, HR, Accountant, Viewer)
- **Storage:** local filesystem now, S3-ready later

## 4. Proposed data model (conceptual — Prisma schema to be written in-repo)

Core entities:
- `User` (auth, role)
- `Client` (billing target — GST No., PAN, address; only relevant to contract billing)
- `ContractWorker` (code, name, basic salary, bank/PF/ESIC IDs, status)
- `InHouseEmployee` (superset: department, designation, joining date, leave balance, documents)
- `PayrollRun` (month, year, status, createdBy) — shared by both modules, `type: CONTRACT | INHOUSE`
- `PayrollLine` (per-worker or per-employee row: working days, OT, gross, PF, ESIC, LWF, advance, net pay) — mirrors the wage-sheet row exactly, one row type serves both modules with nullable module-specific fields
- `Bill` (per client, per month) + `BillLine` (mirrors the bill-sheet rows: basic wages, HRA, ESI×2, LWF×2, service charge, GST, grand total)
- `AuditLog` (who changed what, when)
- `Company` (the contractor's own letterhead details — name, address, GST, PF code, ESI code, bank details, used to populate both wage sheet and bill header)

## 5. Excel/PDF generation strategy

Mirror the Python approach used to analyze this file, in the Node stack:
- Use **ExcelJS** to load the original `.xlsx` as a literal template, clone it per
  payroll run, and only write into the designated data cells (worker rows, header
  month/client fields) — never regenerate the sheet from scratch.
- **Keep every formula as a formula string** (`cell.value = { formula: '...' }`),
  never overwrite with a pre-computed number — this is exactly the compatibility
  requirement from the original brief.
- ExcelJS does not recalculate formulas on save. Two options: (a) let Excel/the
  client recalculate on open (simplest, matches how the original file is actually
  used), or (b) shell out to LibreOffice headless to force a recalculated,
  cached-value copy when the app needs to render values server-side (e.g. for a
  dashboard total) without opening Excel.
- Salary slip PDFs: separate concern from the wage-sheet export — build these as an
  HTML/CSS template rendered to PDF (e.g. Puppeteer), not derived from the xlsx,
  since they need a different single-employee layout with logo/QR/signature.

## 6. Phase plan (re-sequenced for a multi-session Claude Code build)

1. Repo scaffold, Prisma schema, migrations, seed data (workers, one client, one company)
2. Auth + RBAC middleware
3. Contract-worker CRUD + wage-register calculation engine (port the Table-1 formulas exactly, with unit tests proving each formula against the known values in this file: Arun → Gross 17141.67, Net 15978.82, etc.)
4. Bill generation engine (port the Sheet1 formulas, cross-checked against the known Grand Total of 43,077.43 for this file)
5. Excel export (ExcelJS template clone) for both wage register and bill
6. In-house employee module (master data, dashboard, leave/bonus/incentive payroll form)
7. Salary slip PDF generation + batch download
8. Reports (the 10 report types listed in the original spec)
9. Import/export, search, audit log, backup/restore
10. Validation rules + Swagger docs + test suite hardening

## 7. Validation baseline (from the real file — use as regression test fixtures)

| Worker | Gross Earning | Total Ded. | Net Payable |
|---|---|---|---|
| Arun (23 days, 58 OT hrs) | 17,141.67 | 162.85 | 15,978.82 |
| Biru Kumar (18 days, 51 OT hrs) | 13,812.50 | 131.22 | 8,681.28 (adv. 5,000) |
| Suraj (3 days, 1 OT hr) | 1,770.83 | 16.82 | 1,754.01 |
| **Total** | **32,725.00** | **310.89** | **26,414.11** |

Bill grand total for the same month: **43,077.43**.

Any future implementation of these formulas should reproduce these exact figures
before being trusted for a real payroll run.
