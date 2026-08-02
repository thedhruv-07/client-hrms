import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { queryNumber } from "../lib/query";

export const auditLogsRouter = Router();

auditLogsRouter.use(requireAuth);

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     tags: [Audit Logs]
 *     summary: List recent audit log entries, newest first
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Array of audit log entries }
 *       401: { description: Missing or invalid token }
 */
auditLogsRouter.get("/", async (req, res) => {
  const limit = Math.min(Math.max(queryNumber(req.query["limit"]) ?? 20, 1), 100);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(logs);
});
