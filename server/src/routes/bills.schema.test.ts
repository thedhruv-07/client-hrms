import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchema } from "./bills";

test("generateSchema accepts a valid month/year", () => {
  assert.equal(generateSchema.safeParse({ month: 7, year: 2026 }).success, true);
});

test("generateSchema rejects month 0 or 13", () => {
  assert.equal(generateSchema.safeParse({ month: 0, year: 2026 }).success, false);
  assert.equal(generateSchema.safeParse({ month: 13, year: 2026 }).success, false);
});

test("generateSchema rejects a missing year", () => {
  assert.equal(generateSchema.safeParse({ month: 7 }).success, false);
});
