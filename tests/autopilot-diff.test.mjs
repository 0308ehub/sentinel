import assert from "node:assert/strict";
import test from "node:test";

import { parsePatch, unifiedDiff } from "../src/lib/autopilot/diff.ts";

test("unifiedDiff renders additions and their line numbers", () => {
  const patch = unifiedDiff("a.txt", "one\nthree\n", "one\ntwo\nthree\n");
  assert.match(patch, /@@ -1,2 \+1,3 @@/);
  assert.deepEqual(parsePatch(patch).filter((row) => row.kind === "add"), [
    { kind: "add", newLine: 2, text: "two" },
  ]);
});

test("unifiedDiff renders deletions", () => {
  const rows = parsePatch(unifiedDiff("a.txt", "one\ntwo\nthree", "one\nthree"));
  assert.deepEqual(rows.find((row) => row.kind === "del"), { kind: "del", oldLine: 2, text: "two" });
});

test("unifiedDiff renders a mixed replacement", () => {
  const rows = parsePatch(unifiedDiff("a.txt", "old\ntail", "new\ntail"));
  assert.equal(rows.find((row) => row.kind === "del")?.text, "old");
  assert.equal(rows.find((row) => row.kind === "add")?.text, "new");
});

test("unifiedDiff returns empty for no change", () => {
  assert.equal(unifiedDiff("a.txt", "same", "same"), "");
  assert.deepEqual(parsePatch(""), []);
});

test("unifiedDiff trims distant context into separate hunks", () => {
  const before = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n");
  const after = before.replace("line 2", "changed 2").replace("line 11", "changed 11");
  const patch = unifiedDiff("a.txt", before, after, 1);
  assert.equal(patch.match(/^@@/gm)?.length, 2);
  assert.doesNotMatch(patch, /line 6/);
});

test("parsePatch advances old and new line numbers across mixed rows", () => {
  const rows = parsePatch("@@ -4,3 +7,3 @@\n keep\n-old\n+new\n tail");
  assert.deepEqual(rows, [
    { kind: "hunk", text: "@@ -4,3 +7,3 @@" },
    { kind: "context", oldLine: 4, newLine: 7, text: "keep" },
    { kind: "del", oldLine: 5, text: "old" },
    { kind: "add", newLine: 8, text: "new" },
    { kind: "context", oldLine: 6, newLine: 9, text: "tail" },
  ]);
});
