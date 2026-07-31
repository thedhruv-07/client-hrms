import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { listInHouseEmployees } from "@/services/inHouseEmployees";
import { getPayrollRun, getPayrollLines, generateSalarySheet } from "@/services/payrollRuns";
import { usePeriod } from "@/hooks/usePeriod";
import { calculateInHouseWageLine } from "@/lib/calc";
import { monthLabel } from "@/lib/date";
import { formatCurrencyPrecise } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalarySlip, type SalarySlipData } from "@/components/salary-slip";
import { company } from "@/services/mock/seed";
import { toast } from "@/hooks/use-toast";
import type { InHouseEmployee, PayrollLine } from "@/types";

function buildSlipData(employee: InHouseEmployee, line: PayrollLine | undefined, label: string): SalarySlipData {
  const result = line
    ? {
        grossEarning: Number(line.grossEarning),
        pf: Number(line.pf),
        esic: Number(line.esic),
        lwf: Number(line.lwf),
        bonus: Number(line.bonus),
        incentive: Number(line.incentive),
        totalDeduction: Number(line.totalDeduction),
        netPayable: Number(line.netPayable),
        leaveDeduction: Number(employee.basicSalary) + Number(line.bonus) + Number(line.incentive) - Number(line.grossEarning),
      }
    : { ...calculateInHouseWageLine({ basicSalary: Number(employee.basicSalary) }) };

  return {
    companyName: company.name,
    monthLabel: label,
    employeeName: employee.name,
    employeeCode: employee.code,
    department: employee.department,
    designation: employee.designation,
    earnings: [
      { label: "Basic Salary", amount: Number(employee.basicSalary) - result.leaveDeduction },
      { label: "Bonus", amount: result.bonus },
      { label: "Incentive", amount: result.incentive },
    ],
    deductions: [
      { label: "PF", amount: result.pf },
      { label: "ESIC", amount: result.esic },
      { label: "LWF", amount: result.lwf },
    ],
    grossEarning: result.grossEarning,
    totalDeduction: result.totalDeduction,
    netPayable: result.netPayable,
  };
}

export function SalarySlipsPage() {
  const { period } = usePeriod();
  const [preview, setPreview] = useState<SalarySlipData | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);

  const employeesQuery = useQuery({ queryKey: ["in-house-employees", ""], queryFn: () => listInHouseEmployees() });
  const runQuery = useQuery({ queryKey: ["payroll-run", "INHOUSE", period.month, period.year], queryFn: () => getPayrollRun(period.month, period.year, "INHOUSE") });
  const linesQuery = useQuery({
    queryKey: ["payroll-lines", runQuery.data?.id],
    queryFn: () => getPayrollLines(runQuery.data!.id),
    enabled: !!runQuery.data,
  });

  const label = monthLabel(period.month, period.year);
  const isLoading = employeesQuery.isLoading || runQuery.isLoading || (!!runQuery.data && linesQuery.isLoading);

  const activeEmployees = useMemo(() => (employeesQuery.data ?? []).filter((e) => e.status === "ACTIVE"), [employeesQuery.data]);

  async function onDownloadAll() {
    setBatchGenerating(true);
    try {
      const result = await generateSalarySheet(period.month, period.year, "INHOUSE");
      toast({ title: `${activeEmployees.length} salary slips generated`, description: result.filename });
    } catch {
      toast({ title: "Could not generate salary slips", variant: "destructive" });
    } finally {
      setBatchGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Salary Slips</h1>
          <p className="text-sm text-muted">{label}</p>
        </div>
        <Button onClick={onDownloadAll} disabled={isLoading || batchGenerating}>
          <Download className="size-4" />
          {batchGenerating ? "Generating…" : "Download All"}
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
              : activeEmployees.map((employee) => {
                  const line = linesQuery.data?.find((l) => l.inHouseEmployeeId === employee.id);
                  const slip = buildSlipData(employee, line, label);
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="figure">{employee.code}</TableCell>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell className="figure text-right font-medium">{formatCurrencyPrecise(slip.netPayable)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setPreview(slip)}>
                          <FileText className="size-4" />
                          Preview
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Salary Slip Preview</DialogTitle>
          </DialogHeader>
          {preview ? <SalarySlip data={preview} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
