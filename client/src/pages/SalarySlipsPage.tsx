import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { listInHouseEmployees } from "@/services/inHouseEmployees";
import { listContractWorkers } from "@/services/contractWorkers";
import { listClients } from "@/services/clients";
import { getPayrollRun, getPayrollLines } from "@/services/payrollRuns";
import { getCompany } from "@/services/company";
import { usePeriod } from "@/hooks/usePeriod";
import { useModule } from "@/hooks/useModule";
import { calculateInHouseWageLine, calculateWageLine } from "@/lib/calc";
import { downloadSalarySlip, downloadSalarySlipsBatch, type SalarySlipExportData } from "@/lib/exportExcel";
import { downloadSalarySlipPdf, downloadSalarySlipsPdfBatch, downloadSalarySlipsPdfCompact } from "@/services/salarySlips";
import { daysInMonth, monthLabel } from "@/lib/date";
import { formatCurrencyPrecise } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SalarySlip, type SalarySlipData } from "@/components/salary-slip";
import { toast } from "@/hooks/use-toast";
import type { Company, ContractWorker, InHouseEmployee, PayrollLine } from "@/types";

function buildContractSlipData(
  company: Company,
  worker: ContractWorker,
  clientName: string,
  line: PayrollLine | undefined,
  month: number,
  year: number,
  label: string
): SalarySlipData {
  const monthDays = daysInMonth(month, year);

  const result = line
    ? {
        basicEarn: Number(line.basicEarn),
        hraEarn: Number(line.hraEarn),
        taEarn: Number(line.taEarn),
        medicalEarn: Number(line.medicalEarn),
        ceaEarn: Number(line.ceaEarn),
        miscEarn: Number(line.miscEarn),
        otAmount: Number(line.otAmount),
        nightAllowance: Number(line.nightAllowance),
        otArrear: Number(line.otArrear),
        attendAward: Number(line.attendAward),
        incentive: Number(line.incentive),
        incentiveAllowRate: Number(line.incentiveAllowRate),
        bonus: Number(line.bonus),
        leaveEncashment: Number(line.leaveEncashment),
        arrears: Number(line.arrears),
        pf: Number(line.pf),
        esic: Number(line.esic),
        lwf: Number(line.lwf),
        advance: Number(line.advance),
        tds: Number(line.tds),
        otherDeduction: Number(line.otherDeduction),
        otEsic: Number(line.otEsic),
        grossEarning: Number(line.grossEarning),
        totalDeduction: Number(line.totalDeduction),
        netPayable: Number(line.netPayable),
      }
    : (() => {
        // No payroll run yet for this month — assume full attendance off the worker's raw rates, same fallback in-house uses.
        const w = calculateWageLine({
          basicSalary: Number(worker.basicSalary),
          hra: Number(worker.hra),
          ta: Number(worker.ta),
          medicalAllow: Number(worker.medicalAllow),
          cea: Number(worker.cea),
          miscAllow: Number(worker.miscAllow),
          monthDays,
          actualPresentDays: monthDays,
          weekOffHoliday: 0,
          otHours: 0,
        });
        return {
          basicEarn: w.basicEarn,
          hraEarn: w.hraEarn,
          taEarn: w.taEarn,
          medicalEarn: w.medicalEarn,
          ceaEarn: w.ceaEarn,
          miscEarn: w.miscEarn,
          otAmount: 0,
          nightAllowance: 0,
          otArrear: 0,
          attendAward: 0,
          incentive: 0,
          incentiveAllowRate: 0,
          bonus: 0,
          leaveEncashment: 0,
          arrears: 0,
          pf: w.pf,
          esic: w.esic,
          lwf: w.lwf,
          advance: 0,
          tds: 0,
          otherDeduction: 0,
          otEsic: 0,
          grossEarning: w.grossEarning,
          totalDeduction: w.totalDeduction,
          netPayable: w.netPayable,
        };
      })();

  const present = line ? Number(line.actualPresentDays) : monthDays;
  const weekOff = line ? Number(line.weekOffHoliday) : 0;
  const workingDays = present + weekOff;

  return {
    companyName: company.name,
    companyAddress: company.address,
    companyGstNo: company.gstNo,
    monthLabel: label,
    employeeName: worker.name,
    employeeCode: worker.code,
    fatherHusbandName: worker.fatherHusbandName,
    department: worker.category ?? "",
    designation: worker.designation ?? "",
    location: clientName,
    paymentMode: worker.bankAccount ? "Bank Transfer" : null,
    bankAccount: worker.bankAccount,
    ifsc: worker.ifsc,
    pfNo: worker.pfNo,
    esicNo: worker.esicNo,
    uan: worker.uan,
    attendance: {
      monthDays,
      present,
      weekOff,
      holiday: 0,
      cl: 0,
      sl: 0,
      lwp: Math.max(0, monthDays - workingDays),
      payableDays: workingDays,
      otHours: line ? Number(line.otHours) : 0,
    },
    earnings: [
      { label: "Basic", rate: Number(worker.basicSalary), payable: result.basicEarn },
      { label: "HRA", rate: Number(worker.hra), payable: result.hraEarn },
      { label: "S. Bonus", rate: 0, payable: result.bonus },
      { label: "GWA", rate: Number(worker.medicalAllow), payable: result.medicalEarn },
      { label: "F&F", rate: Number(worker.cea) + Number(worker.miscAllow), payable: result.ceaEarn + result.miscEarn },
      { label: "LV Enc.", rate: 0, payable: result.leaveEncashment },
      { label: "Att. Awd.", rate: 0, payable: result.attendAward },
      { label: "Prod. Incen.", rate: result.incentiveAllowRate, payable: result.incentive },
      { label: "Conv. Allow.", rate: Number(worker.ta), payable: result.taEarn },
      { label: "Overtime", rate: 0, payable: result.otAmount + result.nightAllowance + result.otArrear },
    ],
    deductions: [
      { label: "PF", amount: result.pf },
      { label: "ESI", amount: result.esic },
      { label: "LWF", amount: result.lwf },
      { label: "Advance", amount: result.advance },
      { label: "Canteen", amount: 0 },
      { label: "Uniform", amount: 0 },
      { label: "Others", amount: result.tds + result.otherDeduction + result.otEsic },
    ],
    grossEarning: result.grossEarning + result.arrears + result.bonus + result.leaveEncashment,
    totalDeduction: result.totalDeduction,
    netPayable: result.netPayable,
  };
}

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
      { label: "Basic", rate: Number(employee.basicSalary), payable: Number(employee.basicSalary) - result.leaveDeduction },
      { label: "HRA", rate: 0, payable: 0 },
      { label: "S. Bonus", rate: 0, payable: result.bonus },
      { label: "GWA", rate: 0, payable: 0 },
      { label: "F&F", rate: 0, payable: 0 },
      { label: "LV Enc.", rate: 0, payable: 0 },
      { label: "Att. Awd.", rate: 0, payable: 0 },
      { label: "Prod. Incen.", rate: 0, payable: result.incentive },
      { label: "Conv. Allow.", rate: 0, payable: 0 },
      { label: "Overtime", rate: 0, payable: otAmount },
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
  const { module: workerType } = useModule();
  const [clientId, setClientId] = useState<string>("");
  const [preview, setPreview] = useState<SalarySlipData | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [pdfBatchGenerating, setPdfBatchGenerating] = useState(false);
  const [compactGenerating, setCompactGenerating] = useState(false);
  const [pdfDownloadingCode, setPdfDownloadingCode] = useState<string | null>(null);

  const companyQuery = useQuery({ queryKey: ["company"], queryFn: getCompany });

  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: workerType === "CONTRACT" });
  const clients = clientsQuery.data ?? [];
  useEffect(() => {
    if (!clientId && clientsQuery.data && clientsQuery.data.length > 0) setClientId(clientsQuery.data[0].id);
  }, [clientId, clientsQuery.data]);

  const employeesQuery = useQuery({
    queryKey: ["in-house-employees", ""],
    queryFn: () => listInHouseEmployees(),
    enabled: workerType === "INHOUSE",
  });
  const workersQuery = useQuery({
    queryKey: ["contract-workers", "", clientId],
    queryFn: () => listContractWorkers(undefined, clientId),
    enabled: workerType === "CONTRACT" && !!clientId,
  });

  const runQuery = useQuery({
    queryKey: ["payroll-run", workerType, period.month, period.year, workerType === "CONTRACT" ? clientId : undefined],
    queryFn: () => getPayrollRun(period.month, period.year, workerType, workerType === "CONTRACT" ? clientId : undefined),
    enabled: workerType === "INHOUSE" || !!clientId,
  });
  const linesQuery = useQuery({
    queryKey: ["payroll-lines", runQuery.data?.id],
    queryFn: () => getPayrollLines(runQuery.data!.id),
    enabled: !!runQuery.data,
  });

  const label = monthLabel(period.month, period.year);
  const isLoading =
    companyQuery.isLoading ||
    (workerType === "INHOUSE" ? employeesQuery.isLoading : clientsQuery.isLoading || workersQuery.isLoading) ||
    runQuery.isLoading ||
    (!!runQuery.data && linesQuery.isLoading);

  const activeEmployees = useMemo(() => (employeesQuery.data ?? []).filter((e) => e.status === "ACTIVE"), [employeesQuery.data]);
  const activeWorkers = useMemo(() => (workersQuery.data ?? []).filter((w) => w.status === "ACTIVE"), [workersQuery.data]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";

  const slips = useMemo(() => {
    if (!companyQuery.data) return [];
    if (workerType === "INHOUSE") {
      return activeEmployees.map((employee) => {
        const line = linesQuery.data?.find((l) => l.inHouseEmployeeId === employee.id);
        return buildSlipData(companyQuery.data, employee, line, period.month, period.year, label);
      });
    }
    return activeWorkers.map((worker) => {
      const line = linesQuery.data?.find((l) => l.contractWorkerId === worker.id);
      return buildContractSlipData(companyQuery.data, worker, clientName, line, period.month, period.year, label);
    });
  }, [companyQuery.data, workerType, activeEmployees, activeWorkers, clientName, linesQuery.data, period.month, period.year, label]);

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

  async function onDownloadAllPdf() {
    setPdfBatchGenerating(true);
    try {
      await downloadSalarySlipsPdfBatch(slips.map(toExportData), label);
      toast({ title: `${slips.length} salary slips downloaded`, description: `salary-slips-${label.toLowerCase()}.pdf` });
    } catch (err) {
      toast({ title: "Could not generate the PDF", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPdfBatchGenerating(false);
    }
  }

  async function onDownloadAllCompact() {
    setCompactGenerating(true);
    try {
      await downloadSalarySlipsPdfCompact(slips.map(toExportData), label);
      toast({ title: `${slips.length} salary slips downloaded`, description: `4 per page — salary-slips-compact-${label.toLowerCase()}.pdf` });
    } catch (err) {
      toast({ title: "Could not generate the PDF", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCompactGenerating(false);
    }
  }

  async function onDownloadOnePdf(slip: SalarySlipData) {
    setPdfDownloadingCode(slip.employeeCode);
    try {
      await downloadSalarySlipPdf(toExportData(slip));
    } catch (err) {
      toast({ title: "Could not generate the PDF", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPdfDownloadingCode(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Salary Slips</h1>
          <p className="text-sm text-muted">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onDownloadAllCompact} disabled={isLoading || compactGenerating || slips.length === 0}>
            <Download className="size-4" />
            {compactGenerating ? "Preparing…" : "Download All (Compact, 4/page)"}
          </Button>
          <Button variant="outline" onClick={onDownloadAllPdf} disabled={isLoading || pdfBatchGenerating || slips.length === 0}>
            <Download className="size-4" />
            {pdfBatchGenerating ? "Preparing…" : "Download All (.pdf)"}
          </Button>
          <Button onClick={onDownloadAll} disabled={isLoading || batchGenerating || slips.length === 0}>
            <Download className="size-4" />
            {batchGenerating ? "Preparing…" : "Download All (.xlsx)"}
          </Button>
        </div>
      </div>

      {workerType === "CONTRACT" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

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
                      <Button variant="ghost" size="sm" disabled={pdfDownloadingCode === slip.employeeCode} onClick={() => onDownloadOnePdf(slip)}>
                        <Download className="size-4" />
                        {pdfDownloadingCode === slip.employeeCode ? "…" : "PDF"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={downloadingCode === slip.employeeCode} onClick={() => onDownloadOne(slip)}>
                        <Download className="size-4" />
                        {downloadingCode === slip.employeeCode ? "…" : "Excel"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl overflow-x-auto">
          <DialogHeader>
            <DialogTitle>Salary Slip Preview</DialogTitle>
          </DialogHeader>
          {preview ? <SalarySlip data={preview} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
