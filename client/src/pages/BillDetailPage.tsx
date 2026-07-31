import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getBill } from "@/services/bills";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyPrecise } from "@/lib/format";
import { monthLabel } from "@/lib/date";
import type { BillLine } from "@/types";

function LineRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-border py-2 last:border-0 ${emphasis ? "font-semibold" : ""}`}>
      <span className={emphasis ? "" : "text-muted"}>{label}</span>
      <span className="figure">{value}</span>
    </div>
  );
}

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: bill, isLoading } = useQuery({ queryKey: ["bill", id], queryFn: () => getBill(id!), enabled: !!id });

  return (
    <div className="flex flex-col gap-4">
      <Link to="/bills" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to Bills
      </Link>

      {isLoading || !bill ? (
        <Skeleton className="h-96 w-full max-w-2xl" />
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="py-6">
            <div className="mb-6 text-center">
              <p className="font-display text-lg font-semibold">{bill.clientName}</p>
              <p className="text-sm text-muted">Bill for the month of {monthLabel(bill.month, bill.year)}</p>
              <p className="figure mt-1 text-xs text-muted">
                Bill No. {bill.billNo} &middot; {new Date(bill.billDate).toLocaleDateString("en-IN")}
              </p>
            </div>

            {bill.line ? <BillLines line={bill.line} /> : <p className="text-center text-sm text-muted">No line items recorded for this bill.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BillLines({ line }: { line: BillLine }) {
  const amt = (v: string) => formatCurrencyPrecise(Number(v));
  return (
    <div className="flex flex-col">
      <LineRow label="Basic Wages" value={amt(line.basicWages)} />
      <LineRow label="HRA" value={amt(line.hra)} />
      <LineRow label="CON." value={amt(line.con)} />
      <LineRow label='Incentive Amt. (OT total — see PROJECT_SPEC.md §2 on this label)' value={amt(line.incentiveAmt)} />
      <LineRow label="Total (1)" value={amt(line.total1)} emphasis />
      <div className="h-2" />
      <LineRow label="ESI @ 3.25% on Total (1)" value={amt(line.esiEmployer)} />
      <LineRow label="ESI @ 0.75% on Total (1)" value={amt(line.esiEmployee)} />
      <LineRow label="L.W.F @ 0.25% on Total (1)" value={amt(line.lwf1)} />
      <LineRow label="Service Charges @ 7% on Total (1)" value={amt(line.serviceCharge)} />
      <LineRow label="Labour Welfare Fund @ 0.2% x2 (Person)" value={amt(line.lwf2)} />
      <LineRow label="Total (2)" value={amt(line.total2)} emphasis />
      <div className="h-2" />
      <LineRow label="CGST @ 9% on Total (2)" value={amt(line.cgst)} />
      <LineRow label="SGST @ 9% on Total (2)" value={amt(line.sgst)} />
      <div className="mt-2 flex items-center justify-between rounded-sm border-2 border-foreground/60 px-3 py-2.5 text-base font-semibold">
        <span>Grand Total</span>
        <span className="figure">{amt(line.grandTotal)}</span>
      </div>
    </div>
  );
}
