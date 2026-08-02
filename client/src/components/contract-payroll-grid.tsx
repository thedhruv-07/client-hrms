import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listContractWorkers } from "@/services/contractWorkers";
import { getPayrollRun, getPayrollLines, saveContractPayrollRun } from "@/services/payrollRuns";
import { getCompany } from "@/services/company";
import { listClients } from "@/services/clients";
import { listBills } from "@/services/bills";
import { calculateWageLine, sumWageLines, calculateBill } from "@/lib/calc";
import { downloadWageRegisterWithBill } from "@/lib/exportExcel";
import { daysInMonth, monthLabel, monthLabelShort } from "@/lib/date";
import { formatCurrencyPrecise } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StampBadge } from "@/components/ui/stamp-badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download, Save } from "lucide-react";
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
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const clients = clientsQuery.data ?? [];
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    if (!clientId && clientsQuery.data && clientsQuery.data.length > 0) setClientId(clientsQuery.data[0].id);
  }, [clientId, clientsQuery.data]);

  const workersQuery = useQuery({ queryKey: ["contract-workers", "", clientId], queryFn: () => listContractWorkers(undefined, clientId), enabled: !!clientId });
  const runQuery = useQuery({ queryKey: ["payroll-run", "CONTRACT", month, year, clientId], queryFn: () => getPayrollRun(month, year, "CONTRACT", clientId), enabled: !!clientId });
  const linesQuery = useQuery({
    queryKey: ["payroll-lines", runQuery.data?.id],
    queryFn: () => getPayrollLines(runQuery.data!.id),
    enabled: !!runQuery.data,
  });

  const isFinalized = runQuery.data?.status === "FINALIZED";

  const [rows, setRows] = useState<Row[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLoading = !clientId || workersQuery.isLoading || runQuery.isLoading || (!!runQuery.data && linesQuery.isLoading);

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
  }, [workersQuery.data, linesQuery.data, runQuery.data, month, year, clientId]);

  function updateRow(workerId: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.workerId === workerId ? { ...r, ...patch } : r)) ?? prev);
  }

  const computed = useMemo(() => (rows ?? []).map((r) => ({ row: r, result: calculateWageLine({ ...r, monthDays: maxDays }) })), [rows, maxDays]);
  const totals = useMemo(
    () => sumWageLines((rows ?? []).map((r) => ({ basicSalary: r.basicSalary, monthDays: maxDays, workingDays: r.workingDays, otHours: r.otHours, advance: r.advance }))),
    [rows, maxDays]
  );

  async function onGenerate() {
    setGenerating(true);
    try {
      const client = clients.find((c) => c.id === clientId);
      if (!client) throw new Error("No client selected — add one in Clients.");
      const [company, bills] = await Promise.all([getCompany(), listBills(clientId)]);
      const existingBill = bills.find((b) => b.month === month && b.year === year);

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const workingDaysTotal = round2(computed.reduce((sum, { row }) => sum + row.workingDays, 0));
      const esicTotal = round2(computed.reduce((sum, { result }) => sum + result.esic, 0));
      const lwfTotal = round2(computed.reduce((sum, { result }) => sum + result.lwf, 0));
      const advanceTotal = round2(computed.reduce((sum, { result }) => sum + result.advance, 0));

      // The bill is always computed live from this same wage register — never from a
      // possibly-stale persisted Bill — so the two sheets in the download stay internally
      // consistent even if the register has unsaved edits. Only the bill number/date are
      // reused from a real persisted Bill when one already exists for this period.
      const bill = calculateBill({ basicWages: totals.basicEarn, incentiveAmt: totals.otAmount });

      await downloadWageRegisterWithBill({
        companyName: company.name,
        monthLabel: monthLabel(month, year),
        rows: computed.map(({ row, result }) => ({
          code: row.code,
          name: row.name,
          basicSalary: row.basicSalary,
          monthDays: maxDays,
          workingDays: row.workingDays,
          otHours: row.otHours,
          basicEarn: result.basicEarn,
          otAmount: result.otAmount,
          grossEarning: result.grossEarning,
          esic: result.esic,
          lwf: result.lwf,
          advance: result.advance,
          totalDeduction: result.totalDeduction,
          netPayable: result.netPayable,
        })),
        totals: {
          workingDays: workingDaysTotal,
          basicEarn: totals.basicEarn,
          otAmount: totals.otAmount,
          grossEarning: totals.grossEarning,
          esic: esicTotal,
          lwf: lwfTotal,
          advance: advanceTotal,
          totalDeduction: totals.totalDeduction,
          netPayable: totals.netPayable,
        },
        bill: {
          billNo: existingBill?.billNo ?? "DRAFT",
          billDate: existingBill?.billDate ?? new Date().toISOString(),
          monthLabel: monthLabel(month, year),
          monthLabelShort: monthLabelShort(month, year),
          company: {
            name: company.name,
            address: company.address,
            mobile: company.mobile,
            gstNo: company.gstNo,
            pfCode: company.pfCode,
            esiCode: company.esiCode,
            bankAccount: company.bankAccount,
            ifsc: company.ifsc,
            branch: company.branch,
          },
          client: { name: client.name, address: client.address, gstNo: client.gstNo, panNo: client.panNo, hsnSac: client.hsnSac },
          line: bill,
        },
      });
      toast({ title: "Wage register + bill downloaded", description: `wage-register-bill-${(existingBill?.billNo ?? "draft").toLowerCase()}-${monthLabel(month, year).toLowerCase()}.xlsx` });
    } catch (err) {
      toast({ title: "Could not generate the file", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function onSave() {
    if (!rows) return;
    setSaving(true);
    try {
      await saveContractPayrollRun(
        month,
        year,
        clientId,
        rows.map((r) => ({ contractWorkerId: r.workerId, workingDays: r.workingDays, otHours: r.otHours, advance: r.advance }))
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payroll-run", "CONTRACT", month, year, clientId] }),
        queryClient.invalidateQueries({ queryKey: ["payroll-lines"] }),
      ]);
      toast({ title: "Wage register saved", description: `${monthLabel(month, year)} — ${rows.length} worker(s).` });
    } catch (err) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (clientsQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (clients.length === 0) {
    return <p className="text-sm text-muted">No clients yet — add one in Clients before running contract payroll.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold">{monthLabel(month, year)}</h2>
          {rows ? (
            <StampBadge tone={runQuery.data?.status === "FINALIZED" ? "positive" : "ink"}>
              {runQuery.data?.status ?? "DRAFT"}
            </StampBadge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
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
          {!isFinalized ? (
            <Button onClick={onSave} disabled={saving || isLoading} variant="outline">
              <Save className="size-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
          <Button onClick={onGenerate} disabled={generating || isLoading}>
            <Download className="size-4" />
            {generating ? "Preparing…" : "Download Wage Register + Bill (.xlsx)"}
          </Button>
        </div>
      </div>

      {isLoading || !rows ? (
        <Skeleton className="h-96 w-full" />
      ) : (
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
                      disabled={isFinalized}
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
                      disabled={isFinalized}
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
                      disabled={isFinalized}
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
      )}
    </div>
  );
}
