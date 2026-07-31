import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listBills } from "@/services/bills";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StampBadge } from "@/components/ui/stamp-badge";
import { formatCurrencyPrecise } from "@/lib/format";
import { monthLabel } from "@/lib/date";

export function BillsPage() {
  const navigate = useNavigate();
  const { data: bills, isLoading } = useQuery({ queryKey: ["bills"], queryFn: listBills });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Bills</h1>
        <p className="text-sm text-muted">Client GST bills generated per payroll run</p>
      </div>

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
                    <TableCell>{bill.clientName}</TableCell>
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
