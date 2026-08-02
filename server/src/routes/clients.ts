import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

export const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  gstNo: z.string().optional(),
  panNo: z.string().optional(),
  hsnSac: z.string().optional(),
});

export const updateSchema = createSchema.partial();

function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

function idParam(req: Request): string | undefined {
  const id = req.params["id"];
  return typeof id === "string" ? id : undefined;
}

/**
 * @openapi
 * /clients:
 *   get:
 *     tags: [Clients]
 *     summary: List billing clients
 *     responses:
 *       200: { description: Clients }
 *       401: { description: Missing or invalid token }
 */
clientsRouter.get("/", async (_req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json(clients);
});

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     tags: [Clients]
 *     summary: Get a client by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The client }
 *       401: { description: Missing or invalid token }
 *       404: { description: Not found }
 */
clientsRouter.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: idParam(req) } });
  if (!client) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(client);
});

/**
 * @openapi
 * /clients:
 *   post:
 *     tags: [Clients]
 *     summary: Create a billing client (ADMIN, HR)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               gstNo: { type: string }
 *               panNo: { type: string }
 *               hsnSac: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 */
clientsRouter.post("/", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const client = await prisma.client.create({ data: parsed.data });
  await logAudit({ userId: req.user!.id, action: "CREATE", entityType: "Client", entityId: client.id, changes: parsed.data });
  res.status(201).json(client);
});

/**
 * @openapi
 * /clients/{id}:
 *   put:
 *     tags: [Clients]
 *     summary: Update a billing client (ADMIN, HR)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: All fields optional — partial update
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               gstNo: { type: string }
 *               panNo: { type: string }
 *               hsnSac: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Missing or invalid token }
 *       403: { description: Requires ADMIN or HR }
 *       404: { description: Not found }
 */
clientsRouter.put("/:id", requireRole("ADMIN", "HR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const client = await prisma.client.update({ where: { id: idParam(req) }, data: parsed.data });
    await logAudit({ userId: req.user!.id, action: "UPDATE", entityType: "Client", entityId: client.id, changes: parsed.data });
    res.json(client);
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});
