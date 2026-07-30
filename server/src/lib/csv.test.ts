import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, parseCsv } from "./csv";

test("toCsv quotes fields containing commas, quotes, or newlines", () => {
  const csv = toCsv([{ name: 'Arun, "The Boss"', note: "line1\nline2" }], ["name", "note"]);
  assert.equal(csv, 'name,note\n"Arun, ""The Boss""","line1\nline2"');
});

test("toCsv leaves plain fields unquoted", () => {
  const csv = toCsv([{ code: "CW-001", name: "Arun" }], ["code", "name"]);
  assert.equal(csv, "code,name\nCW-001,Arun");
});

test("parseCsv round-trips simple rows", () => {
  const rows = parseCsv("code,name,basicSalary\nCW-001,Arun,17000\nCW-002,Biru Kumar,17000\n");
  assert.deepEqual(rows, [
    { code: "CW-001", name: "Arun", basicSalary: "17000" },
    { code: "CW-002", name: "Biru Kumar", basicSalary: "17000" },
  ]);
});

test("parseCsv handles quoted fields with embedded commas and escaped quotes", () => {
  const rows = parseCsv('code,name\nCW-001,"Arun, ""The Boss"""\n');
  assert.deepEqual(rows, [{ code: "CW-001", name: 'Arun, "The Boss"' }]);
});

test("toCsv output round-trips through parseCsv", () => {
  const original = [
    { code: "CW-001", name: "Arun, Jr." },
    { code: "CW-002", name: 'Biru "Kumar"' },
  ];
  const csv = toCsv(original, ["code", "name"]);
  const parsed = parseCsv(csv);
  assert.deepEqual(parsed, original);
});

test("parseCsv returns an empty array for empty input", () => {
  assert.deepEqual(parseCsv(""), []);
});
