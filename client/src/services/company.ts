import type { Company } from "@/types";
import { api } from "./api";

export type CompanyInput = Partial<Omit<Company, "id" | "createdAt" | "updatedAt">>;

export async function getCompany(): Promise<Company> {
  return api.get<Company>("/company");
}

export async function updateCompany(input: CompanyInput): Promise<Company> {
  return api.put<Company>("/company", input);
}
