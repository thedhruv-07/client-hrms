import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchema } from "./bills";

test("generateSchema accepts a valid month/year/clientId", () => {
  assert.equal(generateSchema.safeParse({ month: 7, year: 2026, clientId: "client-1" }).success, true);
});

test("generateSchema rejects month 0 or 13", () => {
  assert.equal(generateSchema.safeParse({ month: 0, year: 2026, clientId: "client-1" }).success, false);
  assert.equal(generateSchema.safeParse({ month: 13, year: 2026, clientId: "client-1" }).success, false);
});

test("generateSchema rejects a missing year", () => {
  assert.equal(generateSchema.safeParse({ month: 7, clientId: "client-1" }).success, false);
});

test("generateSchema rejects a missing clientId", () => {
  assert.equal(generateSchema.safeParse({ month: 7, year: 2026 }).success, false);
});
