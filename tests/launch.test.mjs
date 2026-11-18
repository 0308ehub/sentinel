import assert from "node:assert/strict";
import test from "node:test";
import { canLaunch, launchChecks } from "../src/lib/autopilot/launch.ts";
import { duePhase, normalizePhases } from "../src/lib/autopilot/rollout-plan.ts";

const ready = {
  kind: "experiment",
  mode: "deterministic",
  hypothesis: "Showing items you may like on the banner will increase purchases.",
  metric: "Purchases",
  guardrail: "Stop if purchases fall.",
  control: "The current banner",
  treatment: "A banner of items you may like",
  page: "/home",
  estimateDays: 14,
  maxDays: 28,
  evidenceCount: 6,
  sourceCount: 2,
};

test("a supported experiment can launch", () => {
  const checks = launchChecks(ready);
  assert.equal(canLaunch(checks), true);
});

test("a thin idea with one source cannot launch", () => {
  const checks = launchChecks({ ...ready, evidenceCount: 2, sourceCount: 1, hypothesis: "Try it" });
  assert.equal(canLaunch(checks), false);
  assert.ok(checks.some((check) => !check.ok && /observations/.test(check.label)));
});

test("a test that varies each request needs a metric and still has to finish in time", () => {
  const checks = launchChecks({ ...ready, mode: "stochastic", estimateDays: 40 });
  assert.equal(canLaunch(checks), false);
  assert.ok(checks.some((check) => /twice the usual traffic/.test(check.label)));
});

test("the current rollout phase starts now and later phases stay in order", () => {
  const now = new Date("2026-03-27T18:30:00.000Z");
  const phases = normalizePhases([
    { at: "2026-01-01T00:00:00.000Z", pass: 20 },
    { at: "2026-03-27T21:00:00.000Z", pass: 50 },
    { at: "2026-03-31T13:00:00.000Z", pass: 90 },
  ], now);
  assert.ok(Array.isArray(phases));
  assert.equal(phases[0].pass, 20);
  assert.equal(phases[0].at, now.toISOString());
  assert.equal(duePhase(phases, now)?.pass, 20);
  assert.equal(duePhase(phases, new Date("2026-03-28T00:00:00.000Z"))?.pass, 50);
  assert.equal(duePhase(phases, new Date("2026-04-01T00:00:00.000Z"))?.pass, 90);
});

test("a phase in the past is rejected", () => {
  const message = normalizePhases([
    { pass: 20 },
    { at: "2020-01-01T00:00:00.000Z", pass: 50 },
  ], new Date("2026-03-27T18:30:00.000Z"));
  assert.equal(typeof message, "string");
});
