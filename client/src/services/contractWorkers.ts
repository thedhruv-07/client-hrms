import type { ContractWorker } from "@/types";
import { contractWorkers } from "./mock/seed";
import { delay, makeId } from "./mock/db";

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
  const filtered = q
    ? contractWorkers.filter(
        (w) => w.name.toLowerCase().includes(q.toLowerCase()) || w.code.toLowerCase().includes(q.toLowerCase())
      )
    : contractWorkers;
  return delay([...filtered].sort((a, b) => a.code.localeCompare(b.code)));
}

export async function getContractWorker(id: string): Promise<ContractWorker | null> {
  return delay(contractWorkers.find((w) => w.id === id) ?? null);
}

export async function createContractWorker(input: ContractWorkerInput): Promise<ContractWorker> {
  if (contractWorkers.some((w) => w.code === input.code)) {
    throw new Error("Code already in use");
  }
  const now = new Date().toISOString();
  const worker: ContractWorker = {
    id: makeId("cw"),
    code: input.code,
    name: input.name,
    basicSalary: input.basicSalary.toFixed(2),
    bankAccount: input.bankAccount ?? null,
    ifsc: input.ifsc ?? null,
    pfNo: input.pfNo ?? null,
    esicNo: input.esicNo ?? null,
    uan: input.uan ?? null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  contractWorkers.push(worker);
  return delay(worker);
}

export async function updateContractWorker(id: string, input: Partial<ContractWorkerInput> & { status?: ContractWorker["status"] }): Promise<ContractWorker> {
  const worker = contractWorkers.find((w) => w.id === id);
  if (!worker) throw new Error("Not found");
  if (input.code && input.code !== worker.code && contractWorkers.some((w) => w.code === input.code)) {
    throw new Error("Code already in use");
  }
  Object.assign(worker, {
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.basicSalary !== undefined ? { basicSalary: input.basicSalary.toFixed(2) } : {}),
    ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
    ...(input.ifsc !== undefined ? { ifsc: input.ifsc } : {}),
    ...(input.pfNo !== undefined ? { pfNo: input.pfNo } : {}),
    ...(input.esicNo !== undefined ? { esicNo: input.esicNo } : {}),
    ...(input.uan !== undefined ? { uan: input.uan } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date().toISOString(),
  });
  return delay(worker);
}

/** Soft delete only — matches the server, since PayrollLine history references workers. */
export async function deactivateContractWorker(id: string): Promise<ContractWorker> {
  return updateContractWorker(id, { status: "INACTIVE" });
}
