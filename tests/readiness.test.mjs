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
