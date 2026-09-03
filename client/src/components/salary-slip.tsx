import { formatCurrency } from "@/lib/format";
import { amountInWords } from "@/lib/exportExcel";

export interface SalarySlipLine {
  label: string;
  amount: number;
}

export interface SalarySlipEarningLine {
  label: string;
  rate: number;
  payable: number;
}

export interface SalarySlipAttendance {
  monthDays: number;
  present: number;
  weekOff: number;
  holiday: number;
  cl: number;
  sl: number;
  lwp: number;
  payableDays: number;
  otHours: number;
}

export interface SalarySlipData {
  companyName: string;
  companyAddress: string;
  companyGstNo: string | null;
  monthLabel: string;
  employeeName: string;
  employeeCode: string;
  fatherHusbandName: string | null;
  department: string;
  designation: string;
  location: string | null;
  paymentMode: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uan: string | null;
  attendance: SalarySlipAttendance;
  earnings: SalarySlipEarningLine[];
  deductions: SalarySlipLine[];
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

function employeeDetailRows(data: SalarySlipData): string[] {
  const bankAc = data.bankAccount ? `${data.bankAccount}${data.ifsc ? ` (${data.ifsc})` : ""}` : undefined;
  const rows: [string, string | null | undefined][] = [
    ["Employee Code", data.employeeCode],
    ["Employee Name", data.employeeName],
    ["Father / Husband", data.fatherHusbandName],
    ["Department", data.department],
    ["Designation", data.designation],
    ["Payment Mode", data.paymentMode],
    ["A/C No.", bankAc],
    ["ESI No.", data.esicNo],
    ["UAN", data.uan],
    ["Location", data.location],
  ];
  return rows.filter(([, value]) => !!value).map(([label, value]) => `${label} : ${value}`);
}

function attendanceRows(a: SalarySlipAttendance): string[] {
  return [
    `Month Days : ${a.monthDays}`,
    `Present : ${a.present}`,
    `W.Off : ${a.weekOff}`,
    `Holiday : ${a.holiday}`,
    `CL : ${a.cl}`,
    `SL : ${a.sl}`,
    `LWP : ${a.lwp}`,
    `Payable : ${a.payableDays}`,
    `OT : ${a.otHours}`,
  ];
}

function deductionRows(lines: SalarySlipLine[]): string[] {
  return lines.map((l) => `${l.label} : ${formatCurrency(l.amount)}`);
}

/**
 * Visual mirror of server/src/export/salarySlip.ts's HTML template — one grid where Employee
 * Details, Attendance, Allowance/Payable, and Deductions run as parallel columns sharing the
 * same rows, matching the source payslip exactly rather than stacking each as its own block.
 */
export function SalarySlip({ data }: { data: SalarySlipData }) {
  const emp = employeeDetailRows(data);
  const att = attendanceRows(data.attendance);
  const ded = deductionRows(data.deductions);
  const earn = data.earnings;
  const maxRows = Math.max(emp.length, att.length, earn.length, ded.length);
  const rows = Array.from({ length: maxRows }, (_, i) => ({ emp: emp[i], att: att[i], earn: earn[i], ded: ded[i] }));
  const rateTotal = earn.reduce((sum, l) => sum + l.rate, 0);

  return (
    <div className="rounded-md border border-border bg-surface p-6 text-xs">
      <div className="mb-2 flex justify-between border-b border-border pb-2 text-[11px] text-muted">
        <span>Authorised Signatory</span>
        <span>Employee&apos;s Signature</span>
      </div>

      <div className="mb-3 text-center">
        <div className="relative flex items-start justify-center">
          <div>
            <p className="font-display text-xl font-semibold">{data.companyName}</p>
            <p className="text-xs text-muted">{data.companyAddress}</p>
            {data.companyGstNo ? <p className="figure text-xs text-muted">GSTIN: {data.companyGstNo}</p> : null}
          </div>
          <span className="absolute right-0 top-0 rounded-sm border border-border px-1.5 py-0.5 text-xs font-semibold">Pay Slip</span>
        </div>
        <p className="mt-2 text-right text-sm font-medium tracking-wide">Payslip For The Month Of : {data.monthLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse rounded-md border border-border">
          <thead>
            <tr className="bg-border/20 text-left text-[10px] font-semibold uppercase tracking-wide">
              <th className="border border-border px-2 py-1">Employee Details</th>
              <th className="border border-border px-2 py-1">Attendance</th>
              <th className="border border-border px-2 py-1" colSpan={2}>
                Allowance
              </th>
              <th className="border border-border px-2 py-1 text-right">Payable</th>
              <th className="border border-border px-2 py-1">Deductions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="figure whitespace-nowrap border border-border px-2 py-1">{r.emp ?? ""}</td>
                <td className="figure whitespace-nowrap border border-border px-2 py-1">{r.att ?? ""}</td>
                <td className="whitespace-nowrap border border-border px-2 py-1">{r.earn?.label ?? ""}</td>
                <td className="figure whitespace-nowrap border border-border px-2 py-1 text-right">{r.earn ? formatCurrency(r.earn.rate) : ""}</td>
                <td className="figure whitespace-nowrap border border-border px-2 py-1 text-right">{r.earn ? formatCurrency(r.earn.payable) : ""}</td>
                <td className="figure whitespace-nowrap border border-border px-2 py-1">{r.ded ?? ""}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="border border-border px-2 py-1" />
              <td className="border border-border px-2 py-1" />
              <td className="border border-border px-2 py-1">Total :</td>
              <td className="figure border border-border px-2 py-1 text-right">{formatCurrency(rateTotal)}</td>
              <td className="figure border border-border px-2 py-1 text-right">{formatCurrency(data.grossEarning)}</td>
              <td className="figure border border-border px-2 py-1 text-right">{formatCurrency(data.totalDeduction)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4 rounded-sm border-2 border-foreground/60 px-3 py-2.5 text-base font-semibold">
        <span>NET SALARY : {formatCurrency(data.netPayable)}</span>
        <span className="figure text-xs font-normal italic text-muted">{amountInWords(data.netPayable)}</span>
      </div>

      <div className="mt-4 flex justify-between border-t border-border pt-2 text-[11px] text-muted">
        <span>Authorised Signatory</span>
        <span>Employee&apos;s Signature</span>
      </div>
    </div>
  );
}
