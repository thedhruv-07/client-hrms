import type { Bill, BillLine } from "@/types";
import { bills, billLines, client } from "./mock/seed";
import { delay } from "./mock/db";

export interface BillWithLine extends Bill {
  clientName: string;
  line: BillLine | null;
}

export async function listBills(): Promise<BillWithLine[]> {
  const rows: BillWithLine[] = bills.map((b) => ({
    ...b,
    clientName: client.name,
    line: billLines.find((bl) => bl.billId === b.id) ?? null,
  }));
  return delay(rows.sort((a, b) => b.year - a.year || b.month - a.month));
}

export async function getBill(id: string): Promise<BillWithLine | null> {
  const bill = bills.find((b) => b.id === id);
  if (!bill) return delay(null);
  return delay({ ...bill, clientName: client.name, line: billLines.find((bl) => bl.billId === bill.id) ?? null });
}
