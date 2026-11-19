import assert from "node:assert/strict";
import test from "node:test";

import { signalIsReady } from "../src/lib/autopilot/readiness.ts";

const base = { distinctEvidence: 5, distinctSources: 2, minEvidence: 5, minSources: 2 };

test("qualitative-only readiness requires two distinct named people", () => {
  assert.equal(signalIsReady({ ...base, evidence: [{ source: "slack", author: "Ada" }, { source: "ticket", author: "Ada" }] }), false);
  assert.equal(signalIsReady({ ...base, evidence: [{ source: "slack", author: "Ada" }, { source: "ticket", author: "Ben" }] }), true);
  assert.equal(signalIsReady({ ...base, evidence: [{ source: "slack", author: "" }, { source: "ticket", author: "Kismet analytics" }] }), false);
});

test("signals with analytics retain the existing readiness thresholds", () => {
  assert.equal(signalIsReady({ ...base, evidence: [{ source: "analytics", author: "Kismet analytics" }] }), true);
  assert.equal(signalIsReady({ ...base, distinctEvidence: 4, evidence: [{ source: "analytics", author: "Kismet analytics" }] }), false);
});

test("a bug is ready from one named reporter, or three items including a ticket", () => {
  assert.equal(signalIsReady({ ...base, kind: "bug", distinctEvidence: 1, distinctSources: 1, evidence: [{ source: "slack", author: "U123" }] }), true);
  assert.equal(signalIsReady({ ...base, kind: "bug", distinctEvidence: 3, distinctSources: 1, evidence: [{ source: "ticket", author: "" }] }), true);
  assert.equal(signalIsReady({ ...base, kind: "bug", distinctEvidence: 2, distinctSources: 2, evidence: [{ source: "slack", author: "Slack" }, { source: "analytics", author: "Kismet analytics" }] }), false);
});
