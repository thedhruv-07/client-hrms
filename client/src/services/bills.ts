import type { Bill, BillLine, Client } from "@/types";
import { api, ApiRequestError } from "./api";

export interface BillWithLine extends Bill {
  client: Client;
  line: BillLine | null;
}

export async function listBills(): Promise<BillWithLine[]> {
  return api.get<BillWithLine[]>("/bills");
}

export async function getBill(id: string): Promise<BillWithLine | null> {
  try {
    return await api.get<BillWithLine>(`/bills/${id}`);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

/** Sums the period's contract wage register (basicEarn, otAmount) server-side and bills it. */
export async function generateBill(month: number, year: number): Promise<BillWithLine> {
  return api.post<BillWithLine>("/bills/generate", { month, year });
}
