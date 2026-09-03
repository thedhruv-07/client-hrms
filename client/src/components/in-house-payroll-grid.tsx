import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listInHouseEmployees } from "@/services/inHouseEmployees";
import { getPayrollRun, getPayrollLines } from "@/services/payrollRuns";
import { calculateInHouseWageLine, sumInHouseWageLines } from "@/lib/calc";
import { downloadInHousePayroll } from "@/lib/exportExcel";
import { monthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StampBadge } from "@/components/ui/stamp-badge";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Row {
  employeeId: string;
  code: string;
  name: string;
  basicSalary: number;
  unpaidLeaveDays: number;
  bonus: number;
  incentive: number;
  advance: number;
}

export function InHousePayrollGrid({ month, year }: { month: number; year: number }) {
  const employeesQuery = useQuery({ queryKey: ["in-house-employees", ""], queryFn: () => listInHouseEmployees() });
  const runQuery = useQuery({ queryKey: ["payroll-run", "INHOUSE", month, year], queryFn: () => getPayrollRun(month, year, "INHOUSE") });
  const linesQuery = useQuery({
    queryKey: ["payroll-lines", runQuery.data?.id],
    queryFn: () => getPayrollLines(runQuery.data!.id),
    enabled: !!runQuery.data,
  });

  const [rows, setRows] = useState<Row[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const isLoading = employeesQuery.isLoading || runQuery.isLoading || (!!runQuery.data && linesQuery.isLoading);

  useEffect(() => {
    if (!employeesQuery.data) return;
    if (runQuery.data && !linesQuery.data) return;

    const active = employeesQuery.data.filter((e) => e.status === "ACTIVE");
    setRows(
      active.map((e) => {
        const line = linesQuery.data?.find((l) => l.inHouseEmployeeId === e.id);
        return {
          employeeId: e.id,
          code: e.code,
          name: e.name,
          basicSalary: Number(e.basicSalary),
          unpaidLeaveDays: 0,
          bonus: line ? Number(line.bonus) : 0,
          incentive: line ? Number(line.incentive) : 0,
          advance: line ? Number(line.advance) : 0,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeesQuery.data, linesQuery.data, runQuery.data, month, year]);

  function updateRow(employeeId: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.employeeId === employeeId ? { ...r, ...patch } : r)) ?? prev);
  }

  const computed = useMemo(() => (rows ?? []).map((r) => ({ row: r, result: calculateInHouseWageLine(r) })), [rows]);
  const totals = useMemo(
    () => sumInHouseWageLines((rows ?? []).map((r) => ({ basicSalary: r.basicSalary, unpaidLeaveDays: r.unpaidLeaveDays, bonus: r.bonus, incentive: r.incentive, advance: r.advance }))),
    [rows]
  );

  async function onGenerate() {
    setGenerating(true);
    try {
      await downloadInHousePayroll({
        monthLabel: monthLabel(month, year),
        rows: computed.map(({ row, result }) => ({
          code: row.code,
          name: row.name,
          unpaidLeaveDays: row.unpaidLeaveDays,
          bonus: result.bonus,
          incentive: result.incentive,
          advance: row.advance,
          grossEarning: result.grossEarning,
          pf: result.pf,
          esic: result.esic,
          totalDeduction: result.totalDeduction,
          netPayable: result.netPayable,
        })),
        totals,
      });
      toast({ title: "Payroll summary downloaded", description: `inhouse-payroll-${monthLabel(month, year).toLowerCase()}.xlsx` });
    } catch {
      toast({ title: "Could not generate the payroll summary", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading || !rows) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold">{monthLabel(month, year)}</h2>
          <StampBadge tone={runQuery.data?.status === "FINALIZED" ? "positive" : "ink"}>
            {runQuery.data?.status ?? "DRAFT"}
          </StampBadge>
        </div>
        <Button onClick={onGenerate} disabled={generating} className="w-full sm:w-auto">
          <Download className="size-4" />
          <span className="hidden sm:inline">{generating ? "Preparing…" : "Download Payroll Summary (.xlsx)"}</span>
          <span className="sm:hidden">{generating ? "Preparing…" : "Payroll Summary"}</span>
        </Button>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Unpaid Leave</TableHead>
              <TableHead className="text-right">Bonus</TableHead>
              <TableHead className="text-right">Incentive</TableHead>
              <TableHead className="text-right">Advance</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">PF</TableHead>
              <TableHead className="text-right">ESIC</TableHead>
              <TableHead className="text-right">Total Ded.</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computed.map(({ row, result }) => (
              <TableRow key={row.employeeId}>
                <TableCell className="figure">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="figure ml-auto h-8 w-20 text-right"
                    value={row.unpaidLeaveDays === 0 ? "" : row.unpaidLeaveDays}
                    onChange={(e) => updateRow(row.employeeId, { unpaidLeaveDays: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="figure ml-auto h-8 w-24 text-right"
                    value={row.bonus === 0 ? "" : row.bonus}
                    onChange={(e) => updateRow(row.employeeId, { bonus: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="figure ml-auto h-8 w-24 text-right"
                    value={row.incentive === 0 ? "" : row.incentive}
                    onChange={(e) => updateRow(row.employeeId, { incentive: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="figure ml-auto h-8 w-24 text-right"
                    value={row.advance === 0 ? "" : row.advance}
                    onChange={(e) => updateRow(row.employeeId, { advance: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="figure text-right font-medium">{formatCurrency(result.grossEarning)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(result.pf)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(result.esic)}</TableCell>
                <TableCell className="figure text-right text-danger">{formatCurrency(result.totalDeduction)}</TableCell>
                <TableCell className="figure text-right font-semibold text-positive">{formatCurrency(result.netPayable)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6}>Totals</TableCell>
              <TableCell className="figure text-right">{formatCurrency(totals.grossEarning)}</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="figure text-right text-danger">{formatCurrency(totals.totalDeduction)}</TableCell>
              <TableCell className="figure text-right text-positive">{formatCurrency(totals.netPayable)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
