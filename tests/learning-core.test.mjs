import assert from "node:assert/strict";
import test from "node:test";
import { fallbackLearning, outcomeFor, relevantLearnings } from "../src/lib/autopilot/learning-core.ts";

function experiment(overrides = {}) {
  return {
    id: "exp_1", signalId: "sig_1", version: 1, kind: "test", title: "Try a shorter form", hypothesis: "", metric: "signup completion",
    metricSpec: null, page: "/signup", overlap: null, guardrail: "", control: "Long form", treatment: "a shorter form",
    flag: "short-form", status: "stopped", rejectedBy: null, branch: null, prUrl: null, prNumber: null, note: null,
    readout: null, rationale: null, directional: null, estimate: null, draftPath: null, coderSessionId: null, agentFailed: false, builder: null, buildRef: null,
    buildUrl: null, buildStartedAt: null, cleanup: null, createdAt: "2026-01-01T00:00:00.000Z", startedAt: null,
    endedAt: "2026-01-02T00:00:00.000Z", ...overrides,
  };
}

function readout(verdict, lift = 0.12) {
  return { arms: [
    { arm: "control", visitors: 2000, conversions: 200, rate: 0.1 },
    { arm: "treatment", visitors: 2100, conversions: 235, rate: 0.112 },
  ], lift, pValue: 0.03, verdict, interaction: null, syntheticShare: 0, at: "2026-01-02T00:00:00.000Z" };
}

test("outcomeFor maps every finished experiment result", () => {
  assert.equal(outcomeFor(experiment({ status: "rolled_out", readout: readout("collecting") })), "won");
  assert.equal(outcomeFor(experiment({ readout: readout("lost", -0.12) })), "lost");
  assert.equal(outcomeFor(experiment({ readout: readout("flat", 0) })), "flat");
  assert.equal(outcomeFor(experiment({ readout: readout("collecting") })), "inconclusive");
  assert.equal(outcomeFor(experiment({ status: "rejected", rejectedBy: "person" })), "rejected");
  assert.equal(outcomeFor(experiment({ kind: "change", status: "rolled_out", startedAt: "2026-01-01T00:00:00Z" })), "directional");
});

test("fallbackLearning writes result, flat, inconclusive, and rejection takeaways", () => {
  const measured = experiment({ readout: readout("won") });
  assert.equal(fallbackLearning(measured, "won"), "Showing a shorter form on /signup raised signup completion by 12% (p=0.03, 4,100 visitors).");
  assert.match(fallbackLearning(measured, "flat"), /made no measurable difference/);
  assert.match(fallbackLearning(experiment(), "inconclusive"), /did not collect enough evidence/);
  assert.equal(fallbackLearning(experiment(), "rejected"), "A person rejected this change before it ran: a shorter form.");
  assert.equal(
    fallbackLearning(experiment({ kind: "change", directional: { before: { visitors: 20, conversions: 2 }, after: { visitors: 25, conversions: 5 }, at: "2026-01-15T00:00:00Z" } }), "directional"),
    "After shipping a shorter form to everyone on /signup, signup completion moved from 10.0% to 20.0% (not a controlled test).",
  );
});

test("relevantLearnings orders same page, then area words, then newest", () => {
  const learning = (id, page, title, createdAt) => ({
    id, experimentId: id, signalId: null, kind: "result", outcome: "won", title, page, metric: "", change: "",
    lift: null, pValue: null, visitors: null, learning: id, createdAt,
  });
  const result = relevantLearnings([
    learning("new", "/other", "Something else", "2026-03-01T00:00:00Z"),
    learning("area", "/settings/billing", "Billing prompt", "2026-01-01T00:00:00Z"),
    learning("page", "/checkout", "Old checkout", "2025-01-01T00:00:00Z"),
  ], { page: "/checkout", area: "billing settings" }, 3);
  assert.deepEqual(result.map((item) => item.id), ["page", "area", "new"]);
});
