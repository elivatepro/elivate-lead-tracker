import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMergeTags, renderSubject, findUnknownMergeTags } from "../../src/lib/automations/merge-tags.ts";

const ctx = { name: "Jane Doe", company: "Acme", source: "web", value: 1200 };

test("substitutes known tags", () => {
  assert.equal(renderMergeTags("Hi {{first_name}} from {{company}} ({{name}}, {{source}}, {{value}})", ctx), "Hi Jane from Acme (Jane Doe, web, 1200)");
});

test("uses the fallback when the value is empty, ignores it otherwise", () => {
  assert.equal(renderMergeTags("Hi {{first_name|there}}", { ...ctx, name: "  " }), "Hi there");
  assert.equal(renderMergeTags("Hi {{first_name|there}}", ctx), "Hi Jane");
  assert.equal(renderMergeTags("{{company|your company}}", { ...ctx, company: null }), "your company");
  assert.equal(renderMergeTags("[{{company}}]", { ...ctx, company: null }), "[]");
});

test("tag names are case-insensitive and tolerate whitespace", () => {
  assert.equal(renderMergeTags("{{ First_Name }}", ctx), "Jane");
});

test("unknown tags are left literal and reported", () => {
  assert.equal(renderMergeTags("Hi {{nickname}}", ctx), "Hi {{nickname}}");
  assert.deepEqual(findUnknownMergeTags("{{name}} {{nickname}} {{phone|x}} {{name}}"), ["nickname", "phone"]);
});

test("substitution is single-pass: lead data can't inject a tag", () => {
  assert.equal(renderMergeTags("Hi {{name}}", { ...ctx, name: "{{company}}" }), "Hi {{company}}");
});

test("subjects are single-line even when lead data contains line breaks", () => {
  const subject = renderSubject("Hi {{name}}", { ...ctx, name: "Evil\r\nBcc: victim@x.co" });
  assert.ok(!/[\r\n]/.test(subject));
  assert.equal(subject, "Hi Evil Bcc: victim@x.co");
});

test("a null value renders empty", () => {
  assert.equal(renderMergeTags("[{{value}}]", { ...ctx, value: null }), "[]");
});
