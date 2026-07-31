import type { Role } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  HR: "HR",
  ACCOUNTANT: "Accountant",
  VIEWER: "Viewer",
};

/** Mirrors server/src/middleware/auth.ts's requireRole usage across routes. */
export const CAN_WRITE_MASTER_DATA: Role[] = ["ADMIN", "HR"];
export const CAN_DELETE: Role[] = ["ADMIN"];
