import { test } from "node:test";
import assert from "node:assert/strict";
import { createSchema, updateSchema } from "./contractWorkers";

test("createSchema accepts a minimal valid payload", () => {
  const result = createSchema.safeParse({ code: "CW-001", name: "Arun", basicSalary: 17000 });
  assert.equal(result.success, true);
});

test("createSchema rejects a missing code", () => {
  const result = createSchema.safeParse({ name: "Arun", basicSalary: 17000 });
  assert.equal(result.success, false);
});

test("createSchema rejects an empty code", () => {
  const result = createSchema.safeParse({ code: "", name: "Arun", basicSalary: 17000 });
  assert.equal(result.success, false);
});

test("createSchema rejects zero or negative basicSalary", () => {
  assert.equal(createSchema.safeParse({ code: "CW-001", name: "Arun", basicSalary: 0 }).success, false);
  assert.equal(createSchema.safeParse({ code: "CW-001", name: "Arun", basicSalary: -1 }).success, false);
});

test("createSchema rejects a non-numeric basicSalary", () => {
  const result = createSchema.safeParse({ code: "CW-001", name: "Arun", basicSalary: "17000" });
  assert.equal(result.success, false);
});

test("updateSchema accepts an empty object (no-op partial update)", () => {
  assert.equal(updateSchema.safeParse({}).success, true);
});

test("updateSchema rejects an invalid status value", () => {
  const result = updateSchema.safeParse({ status: "DELETED" });
  assert.equal(result.success, false);
});

test("updateSchema accepts a single-field partial update", () => {
  const result = updateSchema.safeParse({ status: "INACTIVE" });
  assert.equal(result.success, true);
});
