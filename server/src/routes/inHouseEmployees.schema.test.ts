import { test } from "node:test";
import assert from "node:assert/strict";
import { createSchema, updateSchema } from "./inHouseEmployees";

const VALID = {
  code: "IH-001",
  name: "Priya",
  basicSalary: 30000,
  department: "Engineering",
  designation: "Software Engineer",
  joiningDate: "2026-01-15",
};

test("createSchema accepts a minimal valid payload", () => {
  assert.equal(createSchema.safeParse(VALID).success, true);
});

test("createSchema coerces joiningDate from a date string", () => {
  const result = createSchema.safeParse(VALID);
  assert.equal(result.success, true);
  if (result.success) assert.ok(result.data.joiningDate instanceof Date);
});

test("createSchema rejects an unparseable joiningDate", () => {
  const result = createSchema.safeParse({ ...VALID, joiningDate: "not-a-date" });
  assert.equal(result.success, false);
});

test("createSchema rejects a missing department or designation", () => {
  const { department, ...withoutDept } = VALID;
  assert.equal(createSchema.safeParse(withoutDept).success, false);
});

test("createSchema rejects a negative leaveBalance", () => {
  const result = createSchema.safeParse({ ...VALID, leaveBalance: -1 });
  assert.equal(result.success, false);
});

test("createSchema accepts leaveBalance of exactly 0", () => {
  const result = createSchema.safeParse({ ...VALID, leaveBalance: 0 });
  assert.equal(result.success, true);
});

test("updateSchema accepts an empty object (no-op partial update)", () => {
  assert.equal(updateSchema.safeParse({}).success, true);
});

test("updateSchema rejects an invalid status value", () => {
  assert.equal(updateSchema.safeParse({ status: "GONE" }).success, false);
});
