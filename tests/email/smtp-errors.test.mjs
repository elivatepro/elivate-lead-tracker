import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySmtpError } from "../../src/lib/email/smtp-errors.ts";

const err = (props) => Object.assign(new Error(props.message ?? "smtp error"), props);

test("auth failures are their own kind", () => {
  assert.equal(classifySmtpError(err({ code: "EAUTH" })).kind, "auth");
  assert.equal(classifySmtpError(err({ responseCode: 535 })).kind, "auth");
  assert.equal(classifySmtpError(err({ responseCode: 534, response: "534-5.7.9 Application-specific password required" })).kind, "auth");
  assert.equal(classifySmtpError(err({ message: "Invalid login: 535" })).kind, "auth");
});

test("a nonexistent mailbox is a bounce", () => {
  const e = err({ responseCode: 550, response: "550-5.1.1 The email account that you tried to reach does not exist" });
  assert.equal(classifySmtpError(e).kind, "bounce");
});

test("other 5xx are permanent but do NOT suppress the address (could be a spam block)", () => {
  assert.equal(classifySmtpError(err({ responseCode: 554, response: "554 5.7.1 blocked as spam" })).kind, "permanent");
  assert.equal(classifySmtpError(err({ responseCode: 550, response: "550 5.7.1 rejected by policy" })).kind, "permanent");
});

test("4xx and network errors are retryable", () => {
  assert.equal(classifySmtpError(err({ responseCode: 421 })).kind, "retryable");
  assert.equal(classifySmtpError(err({ responseCode: 451 })).kind, "retryable");
  assert.equal(classifySmtpError(err({ code: "ETIMEDOUT" })).kind, "retryable");
  assert.equal(classifySmtpError(err({ code: "ECONNECTION" })).kind, "retryable");
  assert.equal(classifySmtpError("boom").kind, "retryable");
});
