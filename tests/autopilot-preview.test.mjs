import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreviewOverrides, parseStoredPreview, previewOverridesForPage } from "../src/lib/autopilot/preview.ts";

test("preview overrides parse multiple valid arms", () => {
  assert.deepEqual(parsePreviewOverrides("one:control,two:treatment"), {
    one: "control",
    two: "treatment",
  });
});

test("stored preview overrides expire after 30 minutes", () => {
  const now = 2_000_000;
  const fresh = JSON.stringify({ value: "one:treatment", at: now - 30 * 60 * 1000 });
  const expired = JSON.stringify({ value: "one:treatment", at: now - 30 * 60 * 1000 - 1 });
  assert.deepEqual(parseStoredPreview(fresh, now), { value: "one:treatment", at: 200_000 });
  assert.equal(parseStoredPreview(expired, now), null);
  assert.equal(parseStoredPreview("one:treatment", now), null);
});

test("embedded previews use only the URL and never return stored state", () => {
  const stored = JSON.stringify({ value: "old:control", at: 1000 });
  assert.deepEqual(previewOverridesForPage("new:treatment", true, stored, 1000), {
    overrides: { new: "treatment" },
    stored: null,
  });
});

test("non-embedded preview links refresh persisted override state", () => {
  const stored = JSON.stringify({ value: "old:control", at: 900 });
  assert.deepEqual(previewOverridesForPage("new:treatment", false, stored, 1000), {
    overrides: { old: "control", new: "treatment" },
    stored: { value: "old:control,new:treatment", at: 1000 },
  });
});

test("preview overrides ignore malformed entries and off clears them", () => {
  assert.deepEqual(parsePreviewOverrides("bad,one:invalid,:control,two:treatment"), { two: "treatment" });
  assert.deepEqual(parsePreviewOverrides("off"), {});
  assert.deepEqual(parsePreviewOverrides(null), {});
});
