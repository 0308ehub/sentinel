import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSnapshotHtml, SNAPSHOT_HTML_MAX_BYTES } from "../src/lib/autopilot/snapshot-html.ts";

test("sanitizeSnapshotHtml removes active content and keeps styles and text", () => {
  const input = `<!doctype html><html><head><style>.card { color: red }</style><script>alert(1)</script></head>
    <body onload="steal()"><a href="javascript:steal()" onclick='steal()'>Useful text</a>
    <iframe src="https://bad.example">fallback</iframe><object data="bad"></object><embed src="bad"></body></html>`;
  const result = sanitizeSnapshotHtml(input);
  assert.match(result, /<style>\.card \{ color: red \}<\/style>/);
  assert.match(result, /Useful text/);
  assert.doesNotMatch(result, /<script|onload|onclick|javascript:|<iframe|<object|<embed/i);
});

test("sanitizeSnapshotHtml rejects documents over 2 MB", () => {
  assert.throws(
    () => sanitizeSnapshotHtml("x".repeat(SNAPSHOT_HTML_MAX_BYTES + 1)),
    /larger than 2 MB/,
  );
});

test("sanitizeSnapshotHtml removes meta refresh and base tags", () => {
  const html = '<head><meta http-equiv="refresh" content="0;url=https://x.test"><base href="https://x.test/"><style>p{}</style></head><p>Hi</p>';
  const clean = sanitizeSnapshotHtml(html);
  assert.equal(clean.includes("refresh"), false);
  assert.equal(clean.includes("<base"), false);
  assert.equal(clean.includes("<style>p{}</style>"), true);
});
