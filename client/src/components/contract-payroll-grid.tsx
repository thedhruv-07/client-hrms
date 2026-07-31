import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listContractWorkers } from "@/services/contractWorkers";
import { getPayrollRun, getPayrollLines, generateSalarySheet } from "@/services/payrollRuns";
import { calculateWageLine, sumWageLines } from "@/lib/calc";
import { daysInMonth, monthLabel } from "@/lib/date";
import { formatCurrencyPrecise } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StampBadge } from "@/components/ui/stamp-badge";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Row {
  workerId: string;
  code: string;
  name: string;
  basicSalary: number;
  workingDays: number;
  otHours: number;
  advance: number;
}

export function ContractPayrollGrid({ month, year }: { month: number; year: number }) {
  const maxDays = daysInMonth(month, year);

  const workersQuery = useQuery({ queryKey: ["contract-workers", ""], queryFn: () => listContractWorkers() });
  const runQuery = useQuery({ queryKey: ["payroll-run", "CONTRACT", month, year], queryFn: () => getPayrollRun(month, year, "CONTRACT") });
  const linesQuery = useQuery({
    queryKey: ["payroll-lines", runQuery.data?.id],
    queryFn: () => getPayrollLines(runQuery.data!.id),
    enabled: !!runQuery.data,
  });

  const [rows, setRows] = useState<Row[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const isLoading = workersQuery.isLoading || runQuery.isLoading || (!!runQuery.data && linesQuery.isLoading);

  useEffect(() => {
    if (!workersQuery.data) return;
    if (runQuery.data && !linesQuery.data) return; // wait for lines if a run exists

    const active = workersQuery.data.filter((w) => w.status === "ACTIVE");
    setRows(
      active.map((w) => {
        const line = linesQuery.data?.find((l) => l.contractWorkerId === w.id);
        return {
          workerId: w.id,
          code: w.code,
          name: w.name,
          basicSalary: Number(w.basicSalary),
          workingDays: line ? Number(line.workingDays) : maxDays,
          otHours: line ? Number(line.otHours) : 0,
          advance: line ? Number(line.advance) : 0,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workersQuery.data, linesQuery.data, runQuery.data, month, year]);

  function updateRow(workerId: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.workerId === workerId ? { ...r, ...patch } : r)) ?? prev);
  }

  const computed = useMemo(() => (rows ?? []).map((r) => ({ row: r, result: calculateWageLine(r) })), [rows]);
  const totals = useMemo(() => sumWageLines((rows ?? []).map((r) => ({ basicSalary: r.basicSalary, workingDays: r.workingDays, otHours: r.otHours, advance: r.advance }))), [rows]);

  async function onGenerate() {
    setGenerating(true);
    try {
      const result = await generateSalarySheet(month, year, "CONTRACT");
      toast({ title: "Salary sheet generated", description: result.filename });
    } catch {
      toast({ title: "Could not generate salary sheet", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading || !rows) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold">{monthLabel(month, year)}</h2>
          <StampBadge tone={runQuery.data?.status === "FINALIZED" ? "positive" : "ink"}>
            {runQuery.data?.status ?? "DRAFT"}
          </StampBadge>
        </div>
        <Button onClick={onGenerate} disabled={generating}>
          <Download className="size-4" />
          {generating ? "Generating…" : "Generate Salary Sheet"}
        </Button>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Working Days</TableHead>
              <TableHead className="text-right">OT Hours</TableHead>
              <TableHead className="text-right">Advance</TableHead>
              <TableHead className="text-right">Basic Earn</TableHead>
              <TableHead className="text-right">OT Amount</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">ESIC</TableHead>
              <TableHead className="text-right">LWF</TableHead>
              <TableHead className="text-right">Total Ded.</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computed.map(({ row, result }) => {
              const overMax = row.workingDays > maxDays;
              return (
                <TableRow key={row.workerId}>
                  <TableCell className="figure">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={maxDays}
                      step="1"
                      className={`figure ml-auto h-8 w-20 text-right ${overMax ? "border-danger text-danger" : ""}`}
                      value={row.workingDays}
                      onChange={(e) => updateRow(row.workerId, { workingDays: Number(e.target.value) })}
                    />
                    {overMax ? <p className="mt-1 text-xs text-danger">Max {maxDays} days</p> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      className="figure ml-auto h-8 w-20 text-right"
                      value={row.otHours}
                      onChange={(e) => updateRow(row.workerId, { otHours: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      className="figure ml-auto h-8 w-24 text-right"
                      value={row.advance}
                      onChange={(e) => updateRow(row.workerId, { advance: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="figure text-right">{formatCurrencyPrecise(result.basicEarn)}</TableCell>
                  <TableCell className="figure text-right">{formatCurrencyPrecise(result.otAmount)}</TableCell>
                  <TableCell className="figure text-right font-medium">{formatCurrencyPrecise(result.grossEarning)}</TableCell>
                  <TableCell className="figure text-right">{formatCurrencyPrecise(result.esic)}</TableCell>
                  <TableCell className="figure text-right">{formatCurrencyPrecise(result.lwf)}</TableCell>
                  <TableCell className="figure text-right text-danger">{formatCurrencyPrecise(result.totalDeduction)}</TableCell>
                  <TableCell className="figure text-right font-semibold text-positive">{formatCurrencyPrecise(result.netPayable)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>Totals</TableCell>
              <TableCell className="figure text-right">{formatCurrencyPrecise(totals.basicEarn)}</TableCell>
              <TableCell className="figure text-right">{formatCurrencyPrecise(totals.otAmount)}</TableCell>
              <TableCell className="figure text-right">{formatCurrencyPrecise(totals.grossEarning)}</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="figure text-right text-danger">{formatCurrencyPrecise(totals.totalDeduction)}</TableCell>
              <TableCell className="figure text-right text-positive">{formatCurrencyPrecise(totals.netPayable)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
