import { test } from "node:test";
import assert from "node:assert/strict";
import { evalCondition, evalRule } from "../../src/lib/automations/conditions.ts";
import { lead, STAGE_A, STAGE_B } from "./helpers.mjs";

test("tag rules are case- and whitespace-insensitive", () => {
  const l = lead({ tags: [" Hot "] });
  assert.equal(evalRule({ field: "tag", op: "has", value: "hot" }, l), true);
  assert.equal(evalRule({ field: "tag", op: "not_has", value: "hot" }, l), false);
  assert.equal(evalRule({ field: "tag", op: "not_has", value: "cold" }, l), true);
});

test("stage rules", () => {
  assert.equal(evalRule({ field: "stage", op: "is", value: STAGE_A }, lead()), true);
  assert.equal(evalRule({ field: "stage", op: "is_not", value: STAGE_B }, lead()), true);
  assert.equal(evalRule({ field: "stage", op: "is", value: STAGE_B }, lead()), false);
});

test("source rules", () => {
  const l = lead({ source: "Web Form" });
  assert.equal(evalRule({ field: "source", op: "is", value: "web form" }, l), true);
  assert.equal(evalRule({ field: "source", op: "contains", value: "FORM" }, l), true);
  assert.equal(evalRule({ field: "source", op: "is_not", value: "referral" }, l), true);
  assert.equal(evalRule({ field: "source", op: "is", value: "x" }, lead({ source: null })), false);
});

test("value rules; a lead with no value never matches a numeric comparison", () => {
  const l = lead({ value: 500 });
  assert.equal(evalRule({ field: "value", op: "gt", value: 499 }, l), true);
  assert.equal(evalRule({ field: "value", op: "gte", value: 500 }, l), true);
  assert.equal(evalRule({ field: "value", op: "lt", value: 500 }, l), false);
  assert.equal(evalRule({ field: "value", op: "lte", value: 500 }, l), true);
  assert.equal(evalRule({ field: "value", op: "eq", value: 500 }, l), true);
  const none = lead({ value: null });
  for (const op of ["gt", "gte", "lt", "lte", "eq"]) {
    assert.equal(evalRule({ field: "value", op, value: 0 }, none), false, op);
  }
});

test("company rules treat whitespace as empty", () => {
  assert.equal(evalRule({ field: "company", op: "is_set" }, lead()), true);
  assert.equal(evalRule({ field: "company", op: "is_empty" }, lead({ company: "   " })), true);
  assert.equal(evalRule({ field: "company", op: "is_empty" }, lead({ company: null })), true);
});

test("match all vs any", () => {
  const rules = [
    { field: "tag", op: "has", value: "hot" },
    { field: "value", op: "gt", value: 1000 },
  ];
  const l = lead({ tags: ["hot"], value: 500 });
  assert.equal(evalCondition({ match: "all", rules }, l), false);
  assert.equal(evalCondition({ match: "any", rules }, l), true);
});
