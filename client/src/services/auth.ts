import type { Role } from "@/types";
import { api } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return api.post<LoginResult>("/auth/login", { email, password });
}

export async function me(_token: string): Promise<AuthUser | null> {
  const { user } = await api.get<{ user: AuthUser }>("/auth/me");
  return user;
}
