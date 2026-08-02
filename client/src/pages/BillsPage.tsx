import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listBills, generateBill } from "@/services/bills";
import { listClients } from "@/services/clients";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StampBadge } from "@/components/ui/stamp-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrencyPrecise } from "@/lib/format";
import { monthLabel } from "@/lib/date";
import { usePeriod } from "@/hooks/usePeriod";
import { toast } from "@/hooks/use-toast";

export function BillsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { period } = usePeriod();
  const { data: bills, isLoading } = useQuery({ queryKey: ["bills"], queryFn: () => listBills() });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [clientId, setClientId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!clientId && clients && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const existingBill = (bills ?? []).find((b) => b.month === period.month && b.year === period.year && b.clientId === clientId) ?? null;
  const label = monthLabel(period.month, period.year);

  async function runGenerate() {
    try {
      const bill = await generateBill(period.month, period.year, clientId);
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast({ title: existingBill ? "Bill regenerated" : "Bill generated", description: `Bill No. ${bill.billNo} for ${label}.` });
    } catch (err) {
      toast({ title: "Could not generate bill", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  }

  async function handleRegenerateConfirm() {
    setRegenerating(true);
    try {
      await runGenerate();
      setConfirmOpen(false);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Bills</h1>
          <p className="text-sm text-muted">Client GST bills generated per payroll run</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLoading && clientId ? (
            existingBill ? (
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                Regenerate Bill for {label}
              </Button>
            ) : (
              <Button onClick={runGenerate}>Generate Bill for {label}</Button>
            )
          ) : null}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Bill No. {existingBill?.billNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This recalculates {label}&apos;s bill from the current wage register and overwrites its line items in place — same bill number, fresh
              numbers. The previous figures are not kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={regenerating} onClick={handleRegenerateConfirm}>
              {regenerating ? "Regenerating…" : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : (bills ?? []).map((bill) => (
                  <TableRow key={bill.id} className="cursor-pointer" onClick={() => navigate(`/bills/${bill.id}`)}>
                    <TableCell className="figure">{bill.billNo}</TableCell>
                    <TableCell>{bill.client.name}</TableCell>
                    <TableCell className="figure">{monthLabel(bill.month, bill.year)}</TableCell>
                    <TableCell className="figure">{new Date(bill.billDate).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="figure text-right font-medium">{bill.line ? formatCurrencyPrecise(Number(bill.line.grandTotal)) : "—"}</TableCell>
                    <TableCell>
                      <StampBadge tone="seal">Generated</StampBadge>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && (bills ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted">
                  No bills generated yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
