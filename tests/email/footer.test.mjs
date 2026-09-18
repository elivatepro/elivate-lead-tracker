import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFooter, injectFooterHtml, htmlToText } from "../../src/lib/email/footer.ts";

test("footer contains the unsubscribe link and the address, HTML-escaped", () => {
  const f = buildFooter({ unsubscribeUrl: "https://x.test/unsubscribe/tok?a=1&b=2", address: "Acme <Inc>\n1 Main St" });
  assert.match(f.html, /href="https:\/\/x\.test\/unsubscribe\/tok\?a=1&amp;b=2"/);
  assert.match(f.html, /Acme &lt;Inc&gt;<br\/>1 Main St/);
  assert.ok(!f.html.includes("<Inc>"));
  assert.match(f.text, /Unsubscribe: https:\/\/x\.test\/unsubscribe\/tok\?a=1&b=2/);
  assert.match(f.text, /1 Main St/);
});

test("footer works without an address", () => {
  const f = buildFooter({ unsubscribeUrl: "https://x.test/u", address: null });
  assert.match(f.html, /Unsubscribe/);
  assert.ok(!f.html.includes("<br/>"));
});

test("footer is injected before the closing body tag", () => {
  const out = injectFooterHtml("<!doctype html><html><body><p>Hi</p></body></html>", "<div>FOOT</div>");
  assert.equal(out, "<!doctype html><html><body><p>Hi</p><div>FOOT</div></body></html>");
  assert.equal(injectFooterHtml("<p>no body tag</p>", "<i>f</i>"), "<p>no body tag</p><i>f</i>");
});

test("htmlToText produces readable plain text", () => {
  assert.equal(htmlToText("<p>Hello &amp; welcome</p><p>Line<br/>two</p>"), "Hello & welcome\n\nLine\ntwo");
});
