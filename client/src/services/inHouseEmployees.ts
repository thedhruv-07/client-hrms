import type { InHouseEmployee } from "@/types";
import { api, ApiRequestError } from "./api";

export interface InHouseEmployeeInput {
  code: string;
  name: string;
  fatherHusbandName?: string;
  basicSalary: number;
  department: string;
  designation: string;
  location?: string;
  joiningDate: string;
  leaveBalance?: number;
  paymentMode?: string;
  bankAccount?: string;
  ifsc?: string;
  pfNo?: string;
  esicNo?: string;
  uan?: string;
}

export async function listInHouseEmployees(q?: string): Promise<InHouseEmployee[]> {
  return api.get<InHouseEmployee[]>(`/in-house-employees${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

export async function getInHouseEmployee(id: string): Promise<InHouseEmployee | null> {
  try {
    return await api.get<InHouseEmployee>(`/in-house-employees/${id}`);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function createInHouseEmployee(input: InHouseEmployeeInput): Promise<InHouseEmployee> {
  return api.post<InHouseEmployee>("/in-house-employees", input);
}

export async function updateInHouseEmployee(
  id: string,
  input: Partial<InHouseEmployeeInput> & { status?: InHouseEmployee["status"] }
): Promise<InHouseEmployee> {
  return api.put<InHouseEmployee>(`/in-house-employees/${id}`, input);
}

/** Soft delete only — matches the server, since PayrollLine history references employees. */
export async function deactivateInHouseEmployee(id: string): Promise<InHouseEmployee> {
  return api.delete<InHouseEmployee>(`/in-house-employees/${id}`);
}
