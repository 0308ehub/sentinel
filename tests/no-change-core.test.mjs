import assert from "node:assert/strict";
import test from "node:test";

import { markerOnlyContent, markerOnlyPatch, noChangeReason } from "../src/lib/autopilot/no-change-core.ts";

test("recognizes full content whose only change is the fix marker", () => {
  const original = `<div className="card">Hello</div>\n`;
  assert.equal(markerOnlyContent(original, `<div className="card" data-kismet-fix="fix-card-v1">Hello</div>\n`, "fix-card-v1"), true);
  assert.equal(markerOnlyContent(original, `<div data-kismet-fix="fix-card-v1">Goodbye</div>\n`, "fix-card-v1"), false);
});

test("recognizes a patch whose only change is the fix marker", () => {
  const patch = `@@ -1,3 +1,3 @@
-  <div className="card">Hello</div>
+  <div className="card" data-kismet-fix="fix-card-v1">Hello</div>`;
  assert.equal(markerOnlyPatch([patch], "fix-card-v1"), true);
});

test("rejects marker patches that also change behavior", () => {
  const patch = `@@ -1 +1 @@
-<div>Hello</div>
+<div data-kismet-fix="fix-card-v1">Goodbye</div>`;
  assert.equal(markerOnlyPatch([patch], "fix-card-v1"), false);
  assert.equal(markerOnlyPatch([undefined], "fix-card-v1"), false);
});

test("requires every changed file to be marker-only", () => {
  const marker = `@@ -1 +1 @@\n-<div />\n+<div data-kismet-fix='flag' />`;
  const real = `@@ -1 +1 @@\n-old\n+new`;
  assert.equal(markerOnlyPatch([marker, marker], "flag"), true);
  assert.equal(markerOnlyPatch([marker, real], "flag"), false);
});

test("extracts an explicit no-change reason", () => {
  assert.equal(noChangeReason("Done.\nNO CHANGE NEEDED: the requested behavior already works."), "the requested behavior already works.");
  assert.equal(noChangeReason("I did not make a change."), null);
});
