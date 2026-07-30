import { test } from "node:test";
import assert from "node:assert/strict";
import { sumBy, groupSumBy } from "./aggregate";

test("sumBy sums the picked field", () => {
  const items = [{ x: 10 }, { x: 5.5 }, { x: -2 }];
  assert.equal(sumBy(items, (i) => i.x), 13.5);
});

test("sumBy returns 0 for an empty list", () => {
  assert.equal(sumBy<{ x: number }>([], (i) => i.x), 0);
});

test("groupSumBy buckets by key and sums within each bucket", () => {
  const items = [
    { dept: "Sales", amount: 100 },
    { dept: "Sales", amount: 50 },
    { dept: "Ops", amount: 200 },
  ];
  const result = groupSumBy(items, (i) => i.dept, (i) => i.amount);
  assert.deepEqual(result, { Sales: 150, Ops: 200 });
});

test("groupSumBy returns an empty object for an empty list", () => {
  assert.deepEqual(groupSumBy<{ dept: string; amount: number }>([], (i) => i.dept, (i) => i.amount), {});
});
