import type { ContractWorker } from "@/types";
import { api, ApiRequestError } from "./api";

export interface ContractWorkerInput {
  code: string;
  name: string;
  basicSalary: number;
  bankAccount?: string;
  ifsc?: string;
  pfNo?: string;
  esicNo?: string;
  uan?: string;
}

export async function listContractWorkers(q?: string): Promise<ContractWorker[]> {
  return api.get<ContractWorker[]>(`/contract-workers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
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
