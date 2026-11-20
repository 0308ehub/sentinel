import assert from "node:assert/strict";
import test from "node:test";

import { previewSources, previewVersions } from "../src/lib/autopilot/preview-source-core.ts";

test("a ready sample is the only preview", () => {
  assert.deepEqual(previewSources({ ready: true }), { shown: "sample" });
});

test("nothing is shown until the sample render is ready", () => {
  assert.deepEqual(previewSources({ ready: false }), { shown: "none" });
});

test("a live change compares Current with the version it replaced", () => {
  assert.deepEqual(previewVersions(true), [
    { value: "treatment", label: "Current" },
    { value: "control", label: "Old" },
  ]);
});

test("a change that is not live yet compares Current with the new version", () => {
  assert.deepEqual(previewVersions(false), [
    { value: "control", label: "Current" },
    { value: "treatment", label: "New version" },
  ]);
});
