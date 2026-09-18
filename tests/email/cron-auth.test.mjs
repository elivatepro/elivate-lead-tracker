import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCron } from "../../src/lib/cron-auth.ts";

const req = (auth) => new Request("http://x/api/cron", { headers: auth ? { authorization: auth } : {} });
const SECRET = "c".repeat(40);

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

test("accepts the correct bearer token", () => {
  assert.equal(isAuthorizedCron(req(`Bearer ${SECRET}`)), true);
});

test("rejects wrong, missing, or malformed credentials", () => {
  assert.equal(isAuthorizedCron(req(`Bearer ${"d".repeat(40)}`)), false);
  assert.equal(isAuthorizedCron(req(SECRET)), false);
  assert.equal(isAuthorizedCron(req(undefined)), false);
  assert.equal(isAuthorizedCron(req("")), false);
});

test("fails closed when CRON_SECRET is unset — 'Bearer undefined' must not pass", () => {
  delete process.env.CRON_SECRET;
  assert.equal(isAuthorizedCron(req("Bearer undefined")), false);
  assert.equal(isAuthorizedCron(req("Bearer ")), false);
});

test("fails closed when CRON_SECRET is too short", () => {
  process.env.CRON_SECRET = "abc";
  assert.equal(isAuthorizedCron(req("Bearer abc")), false);
});
