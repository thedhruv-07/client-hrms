import type { Company } from "@/types";
import { company } from "./mock/seed";
import { delay } from "./mock/db";

export type CompanyInput = Partial<Omit<Company, "id" | "createdAt" | "updatedAt">>;

export async function getCompany(): Promise<Company> {
  return delay(company);
}

export async function updateCompany(input: CompanyInput): Promise<Company> {
  Object.assign(company, input, { updatedAt: new Date().toISOString() });
  return delay(company);
}
