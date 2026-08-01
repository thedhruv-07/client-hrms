import { formatCurrencyPrecise } from "@/lib/format";
import { amountInWords } from "@/lib/exportExcel";

export interface SalarySlipLine {
  label: string;
  amount: number;
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
  earnings: SalarySlipLine[];
  deductions: SalarySlipLine[];
  grossEarning: number;
  totalDeduction: number;
  netPayable: number;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 px-3 py-1 text-xs">
      <span className="text-muted">{label}</span>
      <span className="figure text-right">{value || "—"}</span>
    </div>
  );
}

function AttendanceField({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2 px-3 py-1 text-xs">
      <span className="text-muted">{label}</span>
      <span className="figure text-right">{value}</span>
    </div>
  );
}

/** Visual mirror of server/src/export/salarySlip.ts's HTML template — same content shape, our design system's styling. */
export function SalarySlip({ data }: { data: SalarySlipData }) {
  return (
    <div className="rounded-md border border-border bg-surface p-6">
      <div className="mb-2 flex justify-between border-b border-border pb-2 text-[11px] text-muted">
        <span>Authorised Signatory</span>
        <span>Employee&apos;s Signature</span>
      </div>

      <div className="mb-4 text-center">
        <p className="font-display text-xl font-semibold">{data.companyName}</p>
        <p className="text-xs text-muted">{data.companyAddress}</p>
        {data.companyGstNo ? <p className="figure text-xs text-muted">GSTIN: {data.companyGstNo}</p> : null}
        <p className="mt-2 text-sm font-medium uppercase tracking-wide">Pay Slip — {data.monthLabel}</p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-0.5 rounded-md border border-border">
        <DetailField label="Employee Code" value={data.employeeCode} />
        <DetailField label="Employee Name" value={data.employeeName} />
        <DetailField label="Father / Husband" value={data.fatherHusbandName ?? ""} />
        <DetailField label="Department" value={data.department} />
        <DetailField label="Designation" value={data.designation} />
        <DetailField label="Location" value={data.location ?? ""} />
        <DetailField label="Payment Mode" value={data.paymentMode ?? ""} />
        <DetailField label="Bank A/C" value={data.bankAccount ? `${data.bankAccount}${data.ifsc ? ` (${data.ifsc})` : ""}` : ""} />
        <DetailField label="PF No." value={data.pfNo ?? ""} />
        <DetailField label="ESIC No." value={data.esicNo ?? ""} />
        <DetailField label="UAN" value={data.uan ?? ""} />
      </div>

      <div className="mb-4 rounded-md border border-border">
        <div className="border-b border-border bg-border/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">Attendance</div>
        <div className="grid grid-cols-3">
          <AttendanceField label="Month Days" value={data.attendance.monthDays} />
          <AttendanceField label="Present" value={data.attendance.present} />
          <AttendanceField label="W. Off" value={data.attendance.weekOff} />
          <AttendanceField label="Holiday" value={data.attendance.holiday} />
          <AttendanceField label="CL" value={data.attendance.cl} />
          <AttendanceField label="SL" value={data.attendance.sl} />
          <AttendanceField label="LWP" value={data.attendance.lwp} />
          <AttendanceField label="Payable" value={data.attendance.payableDays} />
          <AttendanceField label="OT (hrs)" value={data.attendance.otHours} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border">
          <div className="border-b border-border bg-border/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">Allowance</div>
          {data.earnings.map((l) => (
            <div key={l.label} className="flex justify-between border-b border-border px-3 py-1.5 text-sm last:border-0">
              <span className="text-muted">{l.label}</span>
              <span className="figure">{formatCurrencyPrecise(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-1.5 text-sm font-semibold">
            <span>Total</span>
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
            <span>Total</span>
            <span className="figure">{formatCurrencyPrecise(data.totalDeduction)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-sm border-2 border-foreground/60 px-3 py-2.5 text-base font-semibold">
        <span>Net Salary</span>
        <span className="figure">{formatCurrencyPrecise(data.netPayable)}</span>
      </div>
      <p className="mt-1.5 text-right text-xs italic text-muted">{amountInWords(data.netPayable)}</p>

      <div className="mt-4 flex justify-between border-t border-border pt-2 text-[11px] text-muted">
        <span>Authorised Signatory</span>
        <span>Employee&apos;s Signature</span>
      </div>
    </div>
  );
}
