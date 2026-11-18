import assert from "node:assert/strict";
import test from "node:test";

import { parseTriageResults } from "../src/lib/autopilot/triage-core.ts";

test("parseTriageResults accepts valid unique classifications for known ids", () => {
  assert.deepEqual(parseTriageResults({ results: [
    { id: "sig_1", kind: "bug", reason: "The save action fails." },
    { id: "sig_2", kind: "idea", reason: "The flow works but could be clearer." },
    { id: "sig_1", kind: "idea", reason: "duplicate" },
    { id: "other", kind: "bug", reason: "unknown" },
  ] }, new Set(["sig_1", "sig_2"])), [
    { id: "sig_1", kind: "bug", reason: "The save action fails." },
    { id: "sig_2", kind: "idea", reason: "The flow works but could be clearer." },
  ]);
});

test("parseTriageResults ignores malformed model output", () => {
  assert.deepEqual(parseTriageResults({ results: [{ id: "sig_1", kind: "broken", reason: "x" }, { id: "sig_1", kind: "bug" }] }, new Set(["sig_1"])), []);
  assert.deepEqual(parseTriageResults(null, new Set(["sig_1"])), []);
});
