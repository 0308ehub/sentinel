import assert from "node:assert/strict";
import test from "node:test";
import {
  addedTextFromPatch,
  normalizePreviewCondition,
  textDifference,
} from "../src/lib/autopilot/preview-diff.ts";

test("normalizePreviewCondition makes model conditions fit the preview sentence", () => {
  assert.equal(normalizePreviewCondition("Only when the experiments list is empty"), "when the experiments list is empty");
  assert.equal(normalizePreviewCondition("For first-time visitors."), "for first-time visitors");
});

test("addedTextFromPatch extracts and joins added JSX copy", () => {
  const patch = `diff --git a/src/app/experiments/page.tsx b/src/app/experiments/page.tsx
--- a/src/app/experiments/page.tsx
+++ b/src/app/experiments/page.tsx
@@ -20,0 +21,8 @@
+      {variant === "treatment" && state.experiments.length === 0 && (
+        <p className="mt-3 text-sm text-[#6b7280]">
+          Experiments help you compare product changes and measure outcomes.
+          Start by letting Kismet recommend a safe first experiment from your features,
+          decisions, and analytics.
+        </p>
+      )}`;
  assert.deepEqual(addedTextFromPatch([patch]), [
    "Experiments help you compare product changes and measure outcomes. Start by letting Kismet recommend a safe first experiment from your features, decisions, and analytics.",
  ]);
});

test("addedTextFromPatch ignores class-only changes", () => {
  const patch = `@@ -1 +1 @@
-<div className="rounded border p-3">
+<div className="rounded border border-amber-400 bg-amber-50 p-3">`;
  assert.deepEqual(addedTextFromPatch([patch]), []);
});

test("addedTextFromPatch keeps UI string literals but filters paths, URLs, and flag keys", () => {
  const patch = `@@ -1,0 +1,4 @@
+const emptyState = "Start your first experiment today";
+const source = "../components/experiment-card";
+const docs = "https://example.com/get started";
+const flag = "ap-empty-experiments-v1";`;
  assert.deepEqual(addedTextFromPatch([patch]), ["Start your first experiment today"]);
});

test("textDifference compares normalized text as multisets", () => {
  assert.deepEqual(
    textDifference([" Shared   copy ", "Repeated", "Repeated", "Old copy"], ["Shared copy", "Repeated", "New copy"]),
    { onlyInTreatment: ["New copy"], onlyInControl: ["Repeated", "Old copy"] },
  );
});

test("addedTextFromPatch finds a short label inside an inline JSX expression", () => {
  const patch = [
    "@@ -1,3 +1,4 @@",
    '+      {variant === "treatment" ? <button>Propose feature</button> : null}',
    '+      <Button>Save</Button>',
  ].join("\n");
  assert.deepEqual(addedTextFromPatch([patch]), ["Propose feature", "Save"]);
});
