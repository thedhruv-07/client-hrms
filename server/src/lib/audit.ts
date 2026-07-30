import { prisma } from "./prisma";

export interface AuditEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: unknown;
}

/** Best-effort: a logging failure must never fail the mutation it's describing. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes === undefined ? undefined : (entry.changes as object),
      },
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}
