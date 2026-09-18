import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  UnsubscribeConfigError,
} from "../../src/lib/email/unsubscribe-token.ts";

const WS = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  process.env.UNSUBSCRIBE_TOKEN_SECRET = "s".repeat(48);
});

test("round-trips and normalizes the email", () => {
  const token = signUnsubscribeToken(WS, "  Jane@Example.COM ");
  assert.deepEqual(verifyUnsubscribeToken(token), { workspaceId: WS, email: "jane@example.com" });
});

test("tokens never expire (an old email's link must keep working)", () => {
  const token = signUnsubscribeToken(WS, "a@b.co");
  const realNow = Date.now;
  Date.now = () => realNow() + 10 * 365 * 24 * 3600 * 1000;
  try {
    assert.ok(verifyUnsubscribeToken(token));
  } finally {
    Date.now = realNow;
  }
});

test("rejects a tampered email, workspace, or mac", () => {
  const [v, ws, email, mac] = signUnsubscribeToken(WS, "a@b.co").split(".");
  const otherEmail = Buffer.from("victim@b.co").toString("base64url");
  assert.equal(verifyUnsubscribeToken([v, ws, otherEmail, mac].join(".")), null);
  assert.equal(verifyUnsubscribeToken([v, "99999999-2222-3333-4444-555555555555", email, mac].join(".")), null);
  assert.equal(verifyUnsubscribeToken([v, ws, email, mac.slice(0, -2) + "AA"].join(".")), null);
});

test("rejects tokens signed with a different secret", () => {
  const token = signUnsubscribeToken(WS, "a@b.co");
  process.env.UNSUBSCRIBE_TOKEN_SECRET = "z".repeat(48);
  assert.equal(verifyUnsubscribeToken(token), null);
});

test("rejects malformed tokens", () => {
  for (const bad of ["", "v2.a.b.c", "v1.only", "v1..b.c", "not a token", "v1.a.b.c.d"]) {
    assert.equal(verifyUnsubscribeToken(bad), null, bad);
  }
});

test("a snooze-style hex token can't be replayed as an unsubscribe token", () => {
  const snooze = Buffer.from(`${WS}.9999999999999.deadbeef`).toString("base64url");
  assert.equal(verifyUnsubscribeToken(snooze), null);
});

test("fails closed when the secret is missing or short", () => {
  delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
  assert.throws(() => signUnsubscribeToken(WS, "a@b.co"), UnsubscribeConfigError);
  process.env.UNSUBSCRIBE_TOKEN_SECRET = "short";
  assert.throws(() => signUnsubscribeToken(WS, "a@b.co"), UnsubscribeConfigError);
});
