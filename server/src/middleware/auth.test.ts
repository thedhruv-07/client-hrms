import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { requireAuth, requireRole, signToken } from "./auth";

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

test("requireAuth accepts a valid token and attaches user", () => {
  const token = signToken({ id: "u1", email: "a@b.com", role: "ADMIN" });
  const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
  const res = mockRes();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user?.id, "u1");
  assert.equal(req.user?.role, "ADMIN");
});

test("requireAuth rejects a missing token", () => {
  const req = { headers: {} } as unknown as Request;
  const res = mockRes();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("requireAuth rejects an invalid token", () => {
  const req = { headers: { authorization: "Bearer garbage" } } as unknown as Request;
  const res = mockRes();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("requireRole allows listed roles and blocks others", () => {
  const req = { user: { id: "u1", email: "a@b.com", role: "HR" } } as unknown as Request;

  const resAllowed = mockRes();
  let allowedCalled = false;
  requireRole("HR", "ADMIN")(req, resAllowed, () => {
    allowedCalled = true;
  });
  assert.equal(allowedCalled, true);

  const resBlocked = mockRes();
  let blockedCalled = false;
  requireRole("ADMIN")(req, resBlocked, () => {
    blockedCalled = true;
  });
  assert.equal(blockedCalled, false);
  assert.equal(resBlocked.statusCode, 403);
});
