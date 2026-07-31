import type { Role, User } from "@/types";
import { users } from "./mock/seed";
import { delay } from "./mock/db";

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

function roleForEmail(email: string): Role {
  const lower = email.toLowerCase();
  if (lower.includes("hr")) return "HR";
  if (lower.includes("account")) return "ACCOUNTANT";
  if (lower.includes("viewer")) return "VIEWER";
  return "ADMIN";
}

function encodeToken(user: AuthUser): string {
  return `mock.${btoa(JSON.stringify(user))}.token`;
}

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload)) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Mock: accepts any credentials and derives a role from the email (contains
 * "hr" / "account" / "viewer" -> that role, else ADMIN) so every role is
 * reachable without a role-picker UI. Swap the body for a real
 * POST /auth/login call (server/src/routes/auth.ts) to go live — callers
 * (useAuth) don't change.
 */
export async function login(email: string, _password: string): Promise<LoginResult> {
  const role = roleForEmail(email);
  const template: User = users.find((u) => u.role === role) ?? users[0]!;
  const user: AuthUser = { id: template.id, email, name: template.name, role };
  return delay({ token: encodeToken(user), user }, 500);
}

export async function me(token: string): Promise<AuthUser | null> {
  return decodeToken(token);
}
