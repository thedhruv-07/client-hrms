import { test } from "node:test";
import assert from "node:assert/strict";
import { saveContractRunSchema } from "./payrollRuns";

test("saveContractRunSchema accepts a valid payload", () => {
  const result = saveContractRunSchema.safeParse({
    month: 7,
    year: 2026,
    clientId: "client-1",
    lines: [{ contractWorkerId: "cw-1", actualPresentDays: 20, weekOffHoliday: 3, otHours: 5, advance: 0 }],
  });
  assert.equal(result.success, true);
});

test("saveContractRunSchema accepts an empty lines array", () => {
  assert.equal(saveContractRunSchema.safeParse({ month: 7, year: 2026, clientId: "client-1", lines: [] }).success, true);
});

test("saveContractRunSchema rejects a missing clientId", () => {
  const result = saveContractRunSchema.safeParse({
    month: 7,
    year: 2026,
    lines: [{ contractWorkerId: "cw-1", actualPresentDays: 23 }],
  });
  assert.equal(result.success, false);
});

test("saveContractRunSchema defaults otHours, advance, and weekOffHoliday to 0", () => {
  const result = saveContractRunSchema.safeParse({
    month: 7,
    year: 2026,
    clientId: "client-1",
    lines: [{ contractWorkerId: "cw-1", actualPresentDays: 23 }],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.lines[0]?.otHours, 0);
    assert.equal(result.data.lines[0]?.advance, 0);
    assert.equal(result.data.lines[0]?.weekOffHoliday, 0);
  }
});

test("saveContractRunSchema rejects a negative actualPresentDays", () => {
  const result = saveContractRunSchema.safeParse({
    month: 7,
    year: 2026,
    clientId: "client-1",
    lines: [{ contractWorkerId: "cw-1", actualPresentDays: -1 }],
  });
  assert.equal(result.success, false);
});

test("saveContractRunSchema rejects a missing contractWorkerId", () => {
  const result = saveContractRunSchema.safeParse({
    month: 7,
    year: 2026,
    clientId: "client-1",
    lines: [{ actualPresentDays: 23 }],
  });
  assert.equal(result.success, false);
});
