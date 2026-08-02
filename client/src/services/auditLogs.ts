import type { AuditLog } from "@/types";
import { api } from "./api";

export async function listAuditLogs(limit = 20): Promise<AuditLog[]> {
  return api.get<AuditLog[]>(`/audit-logs?limit=${limit}`);
}
