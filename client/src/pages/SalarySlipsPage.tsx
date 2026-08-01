import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { listInHouseEmployees } from "@/services/inHouseEmployees";
import { getPayrollRun, getPayrollLines } from "@/services/payrollRuns";
import { getCompany } from "@/services/company";
import { usePeriod } from "@/hooks/usePeriod";
import { calculateInHouseWageLine } from "@/lib/calc";
import { downloadSalarySlip, downloadSalarySlipsBatch, type SalarySlipExportData } from "@/lib/exportExcel";
import { daysInMonth, monthLabel } from "@/lib/date";
import { formatCurrencyPrecise } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalarySlip, type SalarySlipData } from "@/components/salary-slip";
import { toast } from "@/hooks/use-toast";
import type { Company, InHouseEmployee, PayrollLine } from "@/types";

function buildSlipData(company: Company, employee: InHouseEmployee, line: PayrollLine | undefined, month: number, year: number, label: string): SalarySlipData {
  const result = line
    ? {
        grossEarning: Number(line.grossEarning),
        pf: Number(line.pf),
        esic: Number(line.esic),
        lwf: Number(line.lwf),
        bonus: Number(line.bonus),
        incentive: Number(line.incentive),
        advance: Number(line.advance),
        totalDeduction: Number(line.totalDeduction),
        netPayable: Number(line.netPayable),
        leaveDeduction: Number(employee.basicSalary) + Number(line.bonus) + Number(line.incentive) - Number(line.grossEarning),
      }
    : { ...calculateInHouseWageLine({ basicSalary: Number(employee.basicSalary) }) };

  const monthDays = daysInMonth(month, year);
  const present = line ? Number(line.workingDays) : monthDays;
  const otHours = line ? Number(line.otHours) : 0;
  const otAmount = (Number(employee.basicSalary) / 30 / 8) * otHours;

  return {
    companyName: company.name,
    companyAddress: company.address,
    companyGstNo: company.gstNo,
    monthLabel: label,
    employeeName: employee.name,
    employeeCode: employee.code,
    fatherHusbandName: employee.fatherHusbandName,
    department: employee.department,
    designation: employee.designation,
    location: employee.location,
    paymentMode: employee.paymentMode,
    bankAccount: employee.bankAccount,
    ifsc: employee.ifsc,
    pfNo: employee.pfNo,
    esicNo: employee.esicNo,
    uan: employee.uan,
    attendance: {
      monthDays,
      present,
      weekOff: 0,
      holiday: 0,
      cl: 0,
      sl: 0,
      lwp: monthDays - present,
      payableDays: present,
      otHours,
    },
    earnings: [
      { label: "Basic", amount: Number(employee.basicSalary) - result.leaveDeduction },
      { label: "HRA", amount: 0 },
      { label: "S. Bonus", amount: result.bonus },
      { label: "GWA", amount: 0 },
      { label: "F&F", amount: 0 },
      { label: "LV Enc.", amount: 0 },
      { label: "Att. Awd.", amount: 0 },
      { label: "Prod. Incen.", amount: result.incentive },
      { label: "Conv. Allow.", amount: 0 },
      { label: "Overtime", amount: otAmount },
    ],
    deductions: [
      { label: "PF", amount: result.pf },
      { label: "ESI", amount: result.esic },
      { label: "LWF", amount: result.lwf },
      { label: "Advance", amount: result.advance },
      { label: "Canteen", amount: 0 },
      { label: "Uniform", amount: 0 },
      { label: "Others", amount: 0 },
    ],
    grossEarning: result.grossEarning + otAmount,
    totalDeduction: result.totalDeduction,
    netPayable: result.netPayable + otAmount,
  };
}

function toExportData(slip: SalarySlipData): SalarySlipExportData {
  return {
    companyName: slip.companyName,
    companyAddress: slip.companyAddress,
    companyGstNo: slip.companyGstNo,
    employeeCode: slip.employeeCode,
    employeeName: slip.employeeName,
    fatherHusbandName: slip.fatherHusbandName,
    department: slip.department,
    designation: slip.designation,
    location: slip.location,
    paymentMode: slip.paymentMode,
    monthLabel: slip.monthLabel,
    bankAccount: slip.bankAccount,
    ifsc: slip.ifsc,
    pfNo: slip.pfNo,
    esicNo: slip.esicNo,
    uan: slip.uan,
    attendance: slip.attendance,
    earnings: slip.earnings,
    deductions: slip.deductions,
    grossEarning: slip.grossEarning,
    totalDeduction: slip.totalDeduction,
    netPayable: slip.netPayable,
  };
}

export function SalarySlipsPage() {
  const { period } = usePeriod();
  const [preview, setPreview] = useState<SalarySlipData | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);

  const companyQuery = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const employeesQuery = useQuery({ queryKey: ["in-house-employees", ""], queryFn: () => listInHouseEmployees() });
  const runQuery = useQuery({ queryKey: ["payroll-run", "INHOUSE", period.month, period.year], queryFn: () => getPayrollRun(period.month, period.year, "INHOUSE") });
  const linesQuery = useQuery({
    queryKey: ["payroll-lines", runQuery.data?.id],
    queryFn: () => getPayrollLines(runQuery.data!.id),
    enabled: !!runQuery.data,
  });

  const label = monthLabel(period.month, period.year);
  const isLoading = companyQuery.isLoading || employeesQuery.isLoading || runQuery.isLoading || (!!runQuery.data && linesQuery.isLoading);

  const activeEmployees = useMemo(() => (employeesQuery.data ?? []).filter((e) => e.status === "ACTIVE"), [employeesQuery.data]);

  const slips = useMemo(
    () =>
      companyQuery.data
        ? activeEmployees.map((employee) => {
            const line = linesQuery.data?.find((l) => l.inHouseEmployeeId === employee.id);
            return buildSlipData(companyQuery.data, employee, line, period.month, period.year, label);
          })
        : [],
    [companyQuery.data, activeEmployees, linesQuery.data, period.month, period.year, label]
  );

  async function onDownloadAll() {
    setBatchGenerating(true);
    try {
      await downloadSalarySlipsBatch(slips.map(toExportData), label);
      toast({ title: `${slips.length} salary slips downloaded`, description: `salary-slips-${label.toLowerCase()}.xlsx` });
    } catch {
      toast({ title: "Could not generate salary slips", variant: "destructive" });
    } finally {
      setBatchGenerating(false);
    }
  }

  async function onDownloadOne(slip: SalarySlipData) {
    setDownloadingCode(slip.employeeCode);
    try {
      await downloadSalarySlip(toExportData(slip));
    } catch {
      toast({ title: "Could not generate the salary slip", variant: "destructive" });
    } finally {
      setDownloadingCode(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Salary Slips</h1>
          <p className="text-sm text-muted">{label}</p>
        </div>
        <Button onClick={onDownloadAll} disabled={isLoading || batchGenerating || slips.length === 0}>
          <Download className="size-4" />
          {batchGenerating ? "Preparing…" : "Download All (.xlsx)"}
        </Button>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : slips.map((slip) => (
                  <TableRow key={slip.employeeCode}>
                    <TableCell className="figure">{slip.employeeCode}</TableCell>
                    <TableCell>{slip.employeeName}</TableCell>
                    <TableCell>{slip.department}</TableCell>
                    <TableCell className="figure text-right font-medium">{formatCurrencyPrecise(slip.netPayable)}</TableCell>
                    <TableCell className="flex justify-end gap-1 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setPreview(slip)}>
                        <FileText className="size-4" />
                        Preview
                      </Button>
                      <Button variant="ghost" size="sm" disabled={downloadingCode === slip.employeeCode} onClick={() => onDownloadOne(slip)}>
                        <Download className="size-4" />
                        {downloadingCode === slip.employeeCode ? "…" : "Download"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Slip Preview</DialogTitle>
          </DialogHeader>
          {preview ? <SalarySlip data={preview} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
