import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { sendMessage } from "../../src/lib/email/transport.ts";
import { buildFooter, injectFooterHtml } from "../../src/lib/email/footer.ts";

async function build(overrides = {}) {
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const footer = buildFooter({ unsubscribeUrl: "https://app.test/unsubscribe/TOKEN", address: "Acme\n1 Main St" });
  const info = await transporter.sendMail({
    from: { name: "Jane Doe", address: "jane@acme.test" },
    to: "lead@example.com",
    subject: "Hello there",
    html: injectFooterHtml("<!doctype html><html><body><p>Hi</p></body></html>", footer.html),
    text: "Hi\n" + footer.text,
    replyTo: "replies@acme.test",
    messageId: "<q1@acme.test>",
    list: { unsubscribe: { url: "https://app.test/api/unsubscribe?t=TOKEN", comment: "Unsubscribe" } },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    ...overrides,
  });
  return info.message.toString();
}

test("real sendMessage() passes the fields we depend on through to nodemailer", async () => {
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const { messageId } = await sendMessage(transporter, {
    from: { name: "Jane Doe", address: "jane@acme.test" },
    to: "lead@example.com",
    subject: "Hello",
    html: "<p>Hi</p>",
    text: "Hi",
    replyTo: "r@acme.test",
    unsubscribeUrl: "https://app.test/api/unsubscribe?t=TOKEN",
    messageId: "<q1@acme.test>",
  });
  assert.equal(messageId, "<q1@acme.test>");
});

test("message carries RFC 8058 one-click unsubscribe headers", async () => {
  const raw = await build();
  assert.match(raw, /^List-Unsubscribe: <https:\/\/app\.test\/api\/unsubscribe\?t=TOKEN>/m);
  assert.match(raw, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
});

test("message is multipart/alternative with plain-text and HTML parts", async () => {
  const raw = await build();
  assert.match(raw, /Content-Type: multipart\/alternative/);
  assert.match(raw, /Content-Type: text\/plain/);
  assert.match(raw, /Content-Type: text\/html/);
  assert.match(raw, /Unsubscribe: https:\/\/app\.test\/unsubscribe\/TOKEN/);
});

test("sender name, reply-to, and message-id are set correctly", async () => {
  const raw = await build();
  assert.match(raw, /^From: Jane Doe <jane@acme\.test>$/m);
  assert.match(raw, /^Reply-To: replies@acme\.test$/m);
  assert.match(raw, /^Message-ID: <q1@acme\.test>$/m);
});

test("a hostile sender name can't inject headers or a second address", async () => {
  const raw = await build({ from: { name: 'Evil"\r\nBcc: victim@x.co <', address: "jane@acme.test" } });
  assert.ok(!/^Bcc:/m.test(raw), "no injected Bcc header");
  assert.match(raw, /^From: .*jane@acme\.test/m);
});
