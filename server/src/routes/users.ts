import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (never includes passwordHash)
 *     responses:
 *       200: { description: Array of users }
 *       401: { description: Missing or invalid token }
 */
usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});
