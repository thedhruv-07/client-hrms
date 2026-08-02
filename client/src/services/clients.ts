import type { Client } from "@/types";
import { api, ApiRequestError } from "./api";

export interface ClientInput {
  name: string;
  address: string;
  gstNo?: string;
  panNo?: string;
  hsnSac?: string;
}

export async function listClients(): Promise<Client[]> {
  return api.get<Client[]>("/clients");
}

export async function getClient(id: string): Promise<Client | null> {
  try {
    return await api.get<Client>(`/clients/${id}`);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function createClient(input: ClientInput): Promise<Client> {
  return api.post<Client>("/clients", input);
}

export async function updateClient(id: string, input: Partial<ClientInput>): Promise<Client> {
  return api.put<Client>(`/clients/${id}`, input);
}
