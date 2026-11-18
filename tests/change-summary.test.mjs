import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackSummary, patchDigest } from "../src/lib/autopilot/change-summary.ts";

test("patchDigest includes file headers and never exceeds its limit", () => {
  const digest = patchDigest([
    { filename: "src/a.tsx", patch: "+hello" },
    { filename: "src/b.ts", patch: "+world" },
  ], 35);
  assert.match(digest, /^FILE: src\/a\.tsx/);
  assert.ok(digest.length <= 35);
});

test("fallbackSummary recognizes visual files", () => {
  const experiment = { control: "Old", treatment: "New", page: "/experiments" };
  assert.equal(fallbackSummary(experiment, [{ filename: "src/page.tsx" }]).kind, "ui");
  assert.equal(fallbackSummary(experiment, [{ filename: "src/api.ts" }]).kind, "behavior");
});
