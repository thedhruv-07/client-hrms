import type { ContractWorker } from "@/types";
import { api, ApiRequestError } from "./api";

export interface ContractWorkerInput {
  code: string;
  name: string;
  fatherHusbandName?: string;
  category?: string;
  designation?: string;
  clientId: string;
  basicSalary: number;
  hra?: number;
  ta?: number;
  medicalAllow?: number;
  cea?: number;
  miscAllow?: number;
  bankAccount?: string;
  ifsc?: string;
  pfNo?: string;
  esicNo?: string;
  uan?: string;
  dob?: string;
  doj?: string;
  mobile?: string;
  aadharNo?: string;
  address?: string;
  bankName?: string;
}

export interface ImportResult {
  created: number;
  total: number;
  results: { row: number; code?: string; error?: string }[];
}

/** Bulk-creates contract workers from a CSV string (header row + rows), reusing the server's existing import endpoint. */
export async function importContractWorkers(csv: string): Promise<ImportResult> {
  return api.post<ImportResult>("/contract-workers/import", { csv });
}

export async function listContractWorkers(q?: string, clientId?: string): Promise<ContractWorker[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (clientId) params.set("clientId", clientId);
  const qs = params.toString();
  return api.get<ContractWorker[]>(`/contract-workers${qs ? `?${qs}` : ""}`);
}

export async function getContractWorker(id: string): Promise<ContractWorker | null> {
  try {
    return await api.get<ContractWorker>(`/contract-workers/${id}`);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function createContractWorker(input: ContractWorkerInput): Promise<ContractWorker> {
  return api.post<ContractWorker>("/contract-workers", input);
}

export async function updateContractWorker(id: string, input: Partial<ContractWorkerInput> & { status?: ContractWorker["status"] }): Promise<ContractWorker> {
  return api.put<ContractWorker>(`/contract-workers/${id}`, input);
}

/** Soft delete only — matches the server, since PayrollLine history references workers. */
export async function deactivateContractWorker(id: string): Promise<ContractWorker> {
  return api.delete<ContractWorker>(`/contract-workers/${id}`);
}
