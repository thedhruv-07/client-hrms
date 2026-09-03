import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listContractWorkers } from "@/services/contractWorkers";
import { getPayrollRun, getPayrollLines, saveContractPayrollRun } from "@/services/payrollRuns";
import { getCompany } from "@/services/company";
import { listClients } from "@/services/clients";
import { listBills } from "@/services/bills";
import { calculateWageLine, sumWageLines, calculateBill, type WageResult } from "@/lib/calc";
import { downloadWageRegisterWithBill, downloadBill, downloadNeftSheet, type BillExportData } from "@/lib/exportExcel";
import { daysInMonth, monthLabel, monthLabelShort } from "@/lib/date";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StampBadge } from "@/components/ui/stamp-badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Row {
  workerId: string;
  code: string;
  name: string;
  fatherHusbandName: string | null;
  category: string | null;
  designation: string | null;
  esicNo: string | null;
  uan: string | null;
  pfNo: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  basicSalary: number;
  hra: number;
  ta: number;
  medicalAllow: number;
  cea: number;
  miscAllow: number;
  actualPresentDays: number;
  weekOffHoliday: number;
  otHours: number;
  advance: number;
  incentiveAllowRate: number;
  attendAward: number;
  nightCount: number;
  nightAllowance: number;
  otArrear: number;
  tds: number;
  otherDeduction: number;
  leaveEncashment: number;
  arrears: number;
  bonus: number;
}

type NumericRowKey = keyof Omit<Row, "workerId" | "code" | "name" | "fatherHusbandName" | "category" | "designation" | "esicNo" | "uan" | "pfNo" | "bankAccount" | "ifsc">;

/** Per-period manual inputs, in on-screen order — everything except the attendance split (actualPresentDays/weekOffHoliday), which has its own max-days validation and sits first. */
const EDITABLE_COLUMNS: { key: NumericRowKey; label: string }[] = [
  { key: "otHours", label: "OT Hours" },
  { key: "advance", label: "Advance" },
  { key: "incentiveAllowRate", label: "Incentive Rate" },
  { key: "attendAward", label: "Attend. Award" },
  { key: "nightCount", label: "No. of Nights" },
  { key: "nightAllowance", label: "Night Allowance" },
  { key: "otArrear", label: "OT Arrear" },
  { key: "tds", label: "TDS" },
  { key: "otherDeduction", label: "Other Ded." },
  { key: "leaveEncashment", label: "Leave Encash." },
  { key: "arrears", label: "Arrears" },
  { key: "bonus", label: "Bonus & Diwali" },
];

/** Computed display columns, in on-screen order. */
const DISPLAY_COLUMNS: { key: keyof WageResult; label: string; emphasis?: boolean; danger?: boolean; positive?: boolean }[] = [
  { key: "basicEarn", label: "Basic Earn" },
  { key: "hraEarn", label: "HRA Earn" },
  { key: "taEarn", label: "TA Earn" },
  { key: "medicalEarn", label: "Medical Earn" },
  { key: "ceaEarn", label: "CEA Earn" },
  { key: "miscEarn", label: "Misc Earn" },
  { key: "otAmount", label: "OT Amount" },
  { key: "incentive", label: "Incentive Amt" },
  { key: "grossEarning", label: "Gross", emphasis: true },
  { key: "pf", label: "PF" },
  { key: "esic", label: "ESIC" },
  { key: "employerEsic", label: "Employer ESIC" },
  { key: "otEsic", label: "OT ESIC" },
  { key: "lwf", label: "LWF" },
  { key: "totalDeduction", label: "Total Ded.", danger: true },
  { key: "netPayable", label: "Net Payable", emphasis: true, positive: true },
];

const PAGE_SIZE = 15;
/** Code + Name stay pinned while the many numeric columns scroll horizontally — widths are fixed so the second sticky column's offset is predictable. */
const CODE_COL_WIDTH = 96;
const NAME_COL_WIDTH = 160;

/** `table-layout: auto` treats a plain `width` as a hint only — min/max pin it exactly, so the sticky column's declared offset always matches its real rendered edge. */
function stickyColStyle(width: number, left = 0): CSSProperties {
  return { left, width, minWidth: width, maxWidth: width };
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
  const [neftGenerating, setNeftGenerating] = useState(false);
  const [billGenerating, setBillGenerating] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [clientId, month, year]);

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
          fatherHusbandName: w.fatherHusbandName,
          category: w.category,
          designation: w.designation,
          esicNo: w.esicNo,
          uan: w.uan,
          pfNo: w.pfNo,
          bankAccount: w.bankAccount,
          ifsc: w.ifsc,
          basicSalary: Number(w.basicSalary),
          hra: Number(w.hra),
          ta: Number(w.ta),
          medicalAllow: Number(w.medicalAllow),
          cea: Number(w.cea),
          miscAllow: Number(w.miscAllow),
          actualPresentDays: line ? Number(line.actualPresentDays) : maxDays,
          weekOffHoliday: line ? Number(line.weekOffHoliday) : 0,
          otHours: line ? Number(line.otHours) : 0,
          advance: line ? Number(line.advance) : 0,
          incentiveAllowRate: line ? Number(line.incentiveAllowRate) : 0,
          attendAward: line ? Number(line.attendAward) : 0,
          nightCount: line ? Number(line.nightCount) : 0,
          nightAllowance: line ? Number(line.nightAllowance) : 0,
          otArrear: line ? Number(line.otArrear) : 0,
          tds: line ? Number(line.tds) : 0,
          otherDeduction: line ? Number(line.otherDeduction) : 0,
          leaveEncashment: line ? Number(line.leaveEncashment) : 0,
          arrears: line ? Number(line.arrears) : 0,
          bonus: line ? Number(line.bonus) : 0,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workersQuery.data, linesQuery.data, runQuery.data, month, year, clientId]);

  function updateRow(workerId: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.workerId === workerId ? { ...r, ...patch } : r)) ?? prev);
  }

  const computed = useMemo(() => (rows ?? []).map((r) => ({ row: r, result: calculateWageLine({ ...r, monthDays: maxDays }) })), [rows, maxDays]);
  const totals = useMemo(() => sumWageLines((rows ?? []).map((r) => ({ ...r, monthDays: maxDays }))), [rows, maxDays]);

  // Pagination is a display-only slice — totals/save/generate always operate on the full `computed` set.
  const pageCount = Math.max(1, Math.ceil(computed.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedComputed = computed.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Attendance columns aren't part of WageResult (they're raw per-row input, not engine output),
  // so their footer totals are summed directly from the rows here.
  const attendanceTotals = useMemo(
    () => ({
      presentDays: computed.reduce((sum, { row }) => sum + row.actualPresentDays, 0),
      weekOffHoliday: computed.reduce((sum, { row }) => sum + row.weekOffHoliday, 0),
      otHours: computed.reduce((sum, { row }) => sum + row.otHours, 0),
    }),
    [computed]
  );

  // sumWageLines omits the statutory-deduction totals (they're per-worker-rounded, see wage.ts) —
  // sum the already-rounded per-worker results here instead, for both the on-screen footer and export.
  const deductionTotals = useMemo(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      pf: round2(computed.reduce((sum, { result }) => sum + result.pf, 0)),
      esic: round2(computed.reduce((sum, { result }) => sum + result.esic, 0)),
      employerEsic: round2(computed.reduce((sum, { result }) => sum + result.employerEsic, 0)),
      otEsic: round2(computed.reduce((sum, { result }) => sum + result.otEsic, 0)),
      lwf: round2(computed.reduce((sum, { result }) => sum + result.lwf, 0)),
    };
  }, [computed]);

  // The bill is always computed live from this same wage register — never from a possibly-stale
  // persisted Bill — so the sheets in the download stay internally consistent even if the
  // register has unsaved edits. Only the bill number/date are reused from a real persisted Bill
  // when one already exists for this period. Shared by the combined wage-register+bill download
  // and the standalone bill-only download.
  async function buildBillExportData(): Promise<{ company: Awaited<ReturnType<typeof getCompany>>; billData: BillExportData }> {
    const client = clients.find((c) => c.id === clientId);
    if (!client) throw new Error("No client selected — add one in Clients.");
    const [company, bills] = await Promise.all([getCompany(), listBills(clientId)]);
    const existingBill = bills.find((b) => b.month === month && b.year === year);

    const bill = calculateBill({
      workerBasicEarnings: computed.map(({ result }) => result.basicEarn),
      workerHraEarnings: computed.map(({ result }) => result.hraEarn),
      otAmount: totals.otAmount,
      attendAward: totals.attendAward,
      incentiveAmt: totals.incentive,
      lwf: deductionTotals.lwf * 2,
    });

    return {
      company,
      billData: {
        billNo: existingBill?.billNo ?? "DRAFT",
        billDate: existingBill?.billDate ?? new Date().toISOString(),
        monthLabel: monthLabel(month, year),
        monthLabelShort: monthLabelShort(month, year),
        company: {
          name: company.name,
          address: company.address,
          mobile: company.mobile,
          email: company.email,
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
    };
  }

  async function onGenerate() {
    setGenerating(true);
    try {
      const { company, billData } = await buildBillExportData();

      const round2 = (n: number) => Math.round(n * 100) / 100;
      // Regular-wages-stream deduction/net figures for the Salary Sheet — excludes otEsic,
      // which belongs to the separate OT Calculation stream's own Net Payable.
      const advanceTotal = computed.reduce((sum, { result }) => sum + result.advance, 0);
      const tdsTotal = computed.reduce((sum, { result }) => sum + result.tds, 0);
      const otherDeductionTotal = computed.reduce((sum, { result }) => sum + result.otherDeduction, 0);
      const regularTotalDeduction = round2(deductionTotals.pf + deductionTotals.esic + deductionTotals.lwf + advanceTotal + tdsTotal + otherDeductionTotal);
      const regularNetPayable = round2(totals.grossWagesErnd + totals.arrears + totals.bonus + totals.leaveEncashment - regularTotalDeduction);
      const otGrossPayableTotal = round2(totals.otAmount + totals.nightAllowance + totals.attendAward + totals.incentive);
      const otTotalGrossPayableTotal = round2(otGrossPayableTotal + totals.otArrear);
      const otNetPayableTotal = round2(otTotalGrossPayableTotal - deductionTotals.otEsic);

      await downloadWageRegisterWithBill({
        companyName: company.name,
        monthLabel: monthLabel(month, year),
        monthDays: maxDays,
        rows: computed.map(({ row, result }) => {
          const regularDeduction = round2(result.pf + result.esic + result.lwf + result.advance + result.tds + result.otherDeduction);
          return {
            code: row.code,
            name: row.name,
            fatherHusbandName: row.fatherHusbandName,
            category: row.category,
            designation: row.designation,
            esicNo: row.esicNo,
            uan: row.uan,
            pfNo: row.pfNo,
            basicSalary: row.basicSalary,
            hra: row.hra,
            ta: row.ta,
            medicalAllow: row.medicalAllow,
            cea: row.cea,
            miscAllow: row.miscAllow,
            monthDays: maxDays,
            actualPresentDays: row.actualPresentDays,
            weekOffHoliday: row.weekOffHoliday,
            basicEarn: result.basicEarn,
            hraEarn: result.hraEarn,
            taEarn: result.taEarn,
            medicalEarn: result.medicalEarn,
            ceaEarn: result.ceaEarn,
            miscEarn: result.miscEarn,
            grossEarning: result.grossWagesErnd,
            pf: result.pf,
            esic: result.esic,
            employerEsic: result.employerEsic,
            lwf: result.lwf,
            tds: result.tds,
            advance: result.advance,
            otherDeduction: result.otherDeduction,
            leaveEncashment: result.leaveEncashment,
            arrears: result.arrears,
            bonus: result.bonus,
            totalDeduction: regularDeduction,
            netPayable: round2(result.grossWagesErnd + result.arrears + result.bonus + result.leaveEncashment - regularDeduction),
          };
        }),
        totals: {
          basicEarn: totals.basicEarn,
          hraEarn: totals.hraEarn,
          taEarn: totals.taEarn,
          medicalEarn: totals.medicalEarn,
          ceaEarn: totals.ceaEarn,
          miscEarn: totals.miscEarn,
          grossEarning: totals.grossWagesErnd,
          pf: deductionTotals.pf,
          esic: deductionTotals.esic,
          employerEsic: deductionTotals.employerEsic,
          lwf: deductionTotals.lwf,
          tds: tdsTotal,
          advance: advanceTotal,
          otherDeduction: otherDeductionTotal,
          leaveEncashment: totals.leaveEncashment,
          arrears: totals.arrears,
          bonus: totals.bonus,
          totalDeduction: regularTotalDeduction,
          netPayable: regularNetPayable,
        },
        otRows: computed.map(({ row, result }) => ({
          code: row.code,
          name: row.name,
          fatherHusbandName: row.fatherHusbandName,
          category: row.category,
          designation: row.designation,
          monthDays: maxDays,
          actualPresentDays: row.actualPresentDays,
          weekOffHoliday: row.weekOffHoliday,
          otHours: row.otHours,
          basicSalary: row.basicSalary,
          incentiveAllowRate: row.incentiveAllowRate,
          otAmount: result.otAmount,
          nightCount: row.nightCount,
          nightAllowance: result.nightAllowance,
          attendAward: result.attendAward,
          incentive: result.incentive,
          grossPayable: round2(result.otAmount + result.nightAllowance + result.attendAward + result.incentive),
          otArrear: result.otArrear,
          otEsic: result.otEsic,
          netPayable: round2(result.otAmount + result.nightAllowance + result.attendAward + result.incentive + result.otArrear - result.otEsic),
        })),
        otTotals: {
          otAmount: totals.otAmount,
          nightAllowance: totals.nightAllowance,
          attendAward: totals.attendAward,
          incentive: totals.incentive,
          grossPayable: otGrossPayableTotal,
          otArrear: totals.otArrear,
          otEsic: deductionTotals.otEsic,
          netPayable: otNetPayableTotal,
        },
        bill: billData,
      });
      toast({ title: "Wage register + bill downloaded", description: `wage-register-bill-${billData.billNo.toLowerCase()}-${monthLabel(month, year).toLowerCase()}.xlsx` });
    } catch (err) {
      toast({ title: "Could not generate the file", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function onDownloadBill() {
    setBillGenerating(true);
    try {
      const { billData } = await buildBillExportData();
      await downloadBill(billData);
      toast({ title: "Bill downloaded", description: `bill-${billData.billNo.toLowerCase()}-${monthLabel(month, year).toLowerCase()}.xlsx` });
    } catch (err) {
      toast({ title: "Could not generate the bill", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setBillGenerating(false);
    }
  }

  async function onDownloadNeft() {
    setNeftGenerating(true);
    try {
      const payable = computed.filter((c) => c.row.bankAccount && c.row.ifsc);
      const skipped = computed.length - payable.length;
      if (payable.length === 0) throw new Error("No workers have both a bank account and IFSC on file.");
      await downloadNeftSheet(
        payable.map(({ row, result }) => ({ accountNumber: row.bankAccount!, accountName: row.name, ifsc: row.ifsc!, amount: result.netPayable })),
        `neft-${clientId ? (clients.find((c) => c.id === clientId)?.name ?? "client").toLowerCase().replace(/\s+/g, "-") : "workers"}-${monthLabel(month, year).toLowerCase()}.xlsx`
      );
      toast({
        title: `NEFT sheet downloaded — ${payable.length} worker(s)`,
        description: skipped > 0 ? `${skipped} worker(s) skipped — missing bank account or IFSC.` : undefined,
      });
    } catch (err) {
      toast({ title: "Could not generate the NEFT sheet", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setNeftGenerating(false);
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
        rows.map((r) => ({
          contractWorkerId: r.workerId,
          actualPresentDays: r.actualPresentDays,
          weekOffHoliday: r.weekOffHoliday,
          otHours: r.otHours,
          advance: r.advance,
          incentiveAllowRate: r.incentiveAllowRate,
          attendAward: r.attendAward,
          nightCount: r.nightCount,
          nightAllowance: r.nightAllowance,
          otArrear: r.otArrear,
          tds: r.tds,
          otherDeduction: r.otherDeduction,
          leaveEncashment: r.leaveEncashment,
          arrears: r.arrears,
          bonus: r.bonus,
        }))
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold">{monthLabel(month, year)}</h2>
          {rows ? (
            <StampBadge tone={runQuery.data?.status === "FINALIZED" ? "positive" : "ink"}>
              {runQuery.data?.status ?? "DRAFT"}
            </StampBadge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full sm:w-56">
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
          <Button variant="outline" onClick={onDownloadNeft} disabled={neftGenerating || isLoading}>
            <Download className="size-4" />
            {neftGenerating ? "Preparing…" : <><span className="hidden sm:inline">Download Bank NEFT Sheet (.xlsx)</span><span className="sm:hidden">NEFT Sheet</span></>}
          </Button>
          <Button variant="outline" onClick={onDownloadBill} disabled={billGenerating || isLoading}>
            <Download className="size-4" />
            {billGenerating ? "Preparing…" : <><span className="hidden sm:inline">Download Bill (.xlsx)</span><span className="sm:hidden">Bill</span></>}
          </Button>
          <Button onClick={onGenerate} disabled={generating || isLoading}>
            <Download className="size-4" />
            {generating ? "Preparing…" : <><span className="hidden sm:inline">Download Wage Register + Bill (.xlsx)</span><span className="sm:hidden">Wage Register</span></>}
          </Button>
        </div>
      </div>

      {isLoading || !rows ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="rounded-md border border-border bg-surface">
          <Table containerClassName="max-h-[65vh]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 top-0 z-30 bg-surface" style={stickyColStyle(CODE_COL_WIDTH)}>
                  Code
                </TableHead>
                <TableHead className="sticky top-0 z-30 bg-surface" style={stickyColStyle(NAME_COL_WIDTH, CODE_COL_WIDTH)}>
                  Name
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-surface text-right">Present Days</TableHead>
                <TableHead className="sticky top-0 z-20 bg-surface text-right">Week Off/Holiday</TableHead>
                {EDITABLE_COLUMNS.map((c) => (
                  <TableHead key={c.key} className="sticky top-0 z-20 bg-surface text-right">
                    {c.label}
                  </TableHead>
                ))}
                {DISPLAY_COLUMNS.map((c) => (
                  <TableHead key={c.key} className="sticky top-0 z-20 bg-surface text-right">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedComputed.map(({ row, result }) => {
                const overMax = row.actualPresentDays + row.weekOffHoliday > maxDays;
                return (
                  <TableRow key={row.workerId}>
                    <TableCell className="figure sticky left-0 z-10 bg-surface" style={stickyColStyle(CODE_COL_WIDTH)}>
                      {row.code}
                    </TableCell>
                    <TableCell className="sticky z-10 bg-surface" style={stickyColStyle(NAME_COL_WIDTH, CODE_COL_WIDTH)}>
                      {row.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={maxDays}
                        step="1"
                        className={`figure ml-auto h-8 w-20 text-right ${overMax ? "border-danger text-danger" : ""}`}
                        value={row.actualPresentDays === 0 ? "" : row.actualPresentDays}
                        disabled={isFinalized}
                        onChange={(e) => updateRow(row.workerId, { actualPresentDays: Number(e.target.value) })}
                      />
                      {overMax ? <p className="mt-1 text-xs text-danger">Max {maxDays} days</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={maxDays}
                        step="1"
                        className="figure ml-auto h-8 w-20 text-right"
                        value={row.weekOffHoliday === 0 ? "" : row.weekOffHoliday}
                        disabled={isFinalized}
                        onChange={(e) => updateRow(row.workerId, { weekOffHoliday: Number(e.target.value) })}
                      />
                    </TableCell>
                    {EDITABLE_COLUMNS.map((c) => (
                      <TableCell key={c.key} className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          className="figure ml-auto h-8 w-24 text-right"
                          value={row[c.key] === 0 ? "" : row[c.key]}
                          disabled={isFinalized}
                          onChange={(e) => updateRow(row.workerId, { [c.key]: Number(e.target.value) })}
                        />
                      </TableCell>
                    ))}
                    {DISPLAY_COLUMNS.map((c) => (
                      <TableCell
                        key={c.key}
                        className={`figure text-right ${c.emphasis ? "font-medium" : ""} ${c.danger ? "text-danger" : ""} ${c.positive ? "font-semibold text-positive" : ""}`}
                      >
                        {formatCurrency(result[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Totals (all {computed.length} worker{computed.length === 1 ? "" : "s"})</TableCell>
                <TableCell className="figure text-right">{formatNumber(attendanceTotals.presentDays)}</TableCell>
                <TableCell className="figure text-right">{formatNumber(attendanceTotals.weekOffHoliday)}</TableCell>
                <TableCell className="figure text-right">{formatNumber(attendanceTotals.otHours)}</TableCell>
                <TableCell colSpan={EDITABLE_COLUMNS.length - 1} />
                <TableCell className="figure text-right">{formatCurrency(totals.basicEarn)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.hraEarn)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.taEarn)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.medicalEarn)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.ceaEarn)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.miscEarn)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.otAmount)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(totals.incentive)}</TableCell>
                <TableCell className="figure text-right font-medium">{formatCurrency(totals.grossEarning)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(deductionTotals.pf)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(deductionTotals.esic)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(deductionTotals.employerEsic)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(deductionTotals.otEsic)}</TableCell>
                <TableCell className="figure text-right">{formatCurrency(deductionTotals.lwf)}</TableCell>
                <TableCell className="figure text-right text-danger">{formatCurrency(totals.totalDeduction)}</TableCell>
                <TableCell className="figure text-right font-semibold text-positive">{formatCurrency(totals.netPayable)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {!isLoading && rows && computed.length > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, computed.length)} of {computed.length} workers
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
