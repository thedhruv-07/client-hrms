import type { InHouseEmployee } from "@/types";
import { inHouseEmployees } from "./mock/seed";
import { delay, makeId } from "./mock/db";

export interface InHouseEmployeeInput {
  code: string;
  name: string;
  basicSalary: number;
  department: string;
  designation: string;
  joiningDate: string;
  leaveBalance?: number;
  bankAccount?: string;
  ifsc?: string;
  pfNo?: string;
  esicNo?: string;
  uan?: string;
}

export async function listInHouseEmployees(q?: string): Promise<InHouseEmployee[]> {
  const filtered = q
    ? inHouseEmployees.filter(
        (e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.code.toLowerCase().includes(q.toLowerCase())
      )
    : inHouseEmployees;
  return delay([...filtered].sort((a, b) => a.code.localeCompare(b.code)));
}

export async function getInHouseEmployee(id: string): Promise<InHouseEmployee | null> {
  return delay(inHouseEmployees.find((e) => e.id === id) ?? null);
}

export async function createInHouseEmployee(input: InHouseEmployeeInput): Promise<InHouseEmployee> {
  if (inHouseEmployees.some((e) => e.code === input.code)) {
    throw new Error("Code already in use");
  }
  const now = new Date().toISOString();
  const employee: InHouseEmployee = {
    id: makeId("ihe"),
    code: input.code,
    name: input.name,
    basicSalary: input.basicSalary.toFixed(2),
    department: input.department,
    designation: input.designation,
    joiningDate: input.joiningDate,
    leaveBalance: (input.leaveBalance ?? 0).toFixed(2),
    bankAccount: input.bankAccount ?? null,
    ifsc: input.ifsc ?? null,
    pfNo: input.pfNo ?? null,
    esicNo: input.esicNo ?? null,
    uan: input.uan ?? null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  inHouseEmployees.push(employee);
  return delay(employee);
}

export async function updateInHouseEmployee(
  id: string,
  input: Partial<InHouseEmployeeInput> & { status?: InHouseEmployee["status"] }
): Promise<InHouseEmployee> {
  const employee = inHouseEmployees.find((e) => e.id === id);
  if (!employee) throw new Error("Not found");
  if (input.code && input.code !== employee.code && inHouseEmployees.some((e) => e.code === input.code)) {
    throw new Error("Code already in use");
  }
  Object.assign(employee, {
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.basicSalary !== undefined ? { basicSalary: input.basicSalary.toFixed(2) } : {}),
    ...(input.department !== undefined ? { department: input.department } : {}),
    ...(input.designation !== undefined ? { designation: input.designation } : {}),
    ...(input.joiningDate !== undefined ? { joiningDate: input.joiningDate } : {}),
    ...(input.leaveBalance !== undefined ? { leaveBalance: input.leaveBalance.toFixed(2) } : {}),
    ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
    ...(input.ifsc !== undefined ? { ifsc: input.ifsc } : {}),
    ...(input.pfNo !== undefined ? { pfNo: input.pfNo } : {}),
    ...(input.esicNo !== undefined ? { esicNo: input.esicNo } : {}),
    ...(input.uan !== undefined ? { uan: input.uan } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date().toISOString(),
  });
  return delay(employee);
}

/** Soft delete only — matches the server, since PayrollLine history references employees. */
export async function deactivateInHouseEmployee(id: string): Promise<InHouseEmployee> {
  return updateInHouseEmployee(id, { status: "INACTIVE" });
}
