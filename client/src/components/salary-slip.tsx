import { formatCurrencyPrecise } from "@/lib/format";

export interface SalarySlipLine {
  label: string;
  amount: number;
}

export interface SalarySlipData {
  companyName: string;
  monthLabel: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  earnings: SalarySlipLine[];
  deductions: SalarySlipLine[];
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

/** Visual mirror of server/src/export/salarySlip.ts's HTML template — same content shape, our design system's styling. */
export function SalarySlip({ data }: { data: SalarySlipData }) {
  return (
    <div className="rounded-md border border-border bg-surface p-6">
      <div className="mb-4 text-center">
        <p className="font-display text-lg font-semibold">{data.companyName}</p>
        <p className="text-sm text-muted">Salary Slip — {data.monthLabel}</p>
      </div>
      <div className="mb-4 flex justify-between text-sm">
        <span className="text-muted">Employee</span>
        <span className="text-right">
          {data.employeeName} <span className="figure text-muted">({data.employeeCode})</span>
          <br />
          <span className="text-xs text-muted">
            {data.designation}, {data.department}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border">
          <div className="border-b border-border bg-border/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">Earnings</div>
          {data.earnings.map((l) => (
            <div key={l.label} className="flex justify-between border-b border-border px-3 py-1.5 text-sm last:border-0">
              <span className="text-muted">{l.label}</span>
              <span className="figure">{formatCurrencyPrecise(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-1.5 text-sm font-semibold">
            <span>Gross Earning</span>
            <span className="figure">{formatCurrencyPrecise(data.grossEarning)}</span>
          </div>
        </div>
        <div className="rounded-md border border-border">
          <div className="border-b border-border bg-border/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">Deductions</div>
          {data.deductions.map((l) => (
            <div key={l.label} className="flex justify-between border-b border-border px-3 py-1.5 text-sm last:border-0">
              <span className="text-muted">{l.label}</span>
              <span className="figure">{formatCurrencyPrecise(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-1.5 text-sm font-semibold">
            <span>Total Deduction</span>
            <span className="figure">{formatCurrencyPrecise(data.totalDeduction)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-sm border-2 border-foreground/60 px-3 py-2.5 text-base font-semibold">
        <span>Net Payable</span>
        <span className="figure">{formatCurrencyPrecise(data.netPayable)}</span>
      </div>
    </div>
  );
}
