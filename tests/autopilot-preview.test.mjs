import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreviewOverrides } from "../src/lib/autopilot/preview.ts";

test("preview overrides parse multiple valid arms", () => {
  assert.deepEqual(parsePreviewOverrides("one:control,two:treatment"), {
    one: "control",
    two: "treatment",
  });
});

test("preview overrides ignore malformed entries and off clears them", () => {
  assert.deepEqual(parsePreviewOverrides("bad,one:invalid,:control,two:treatment"), { two: "treatment" });
  assert.deepEqual(parsePreviewOverrides("off"), {});
  assert.deepEqual(parsePreviewOverrides(null), {});
});
