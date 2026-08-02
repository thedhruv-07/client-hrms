import type { User } from "@/types";
import { api } from "./api";

export async function listUsers(): Promise<User[]> {
  return api.get<User[]>("/users");
}
