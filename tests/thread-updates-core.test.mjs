import assert from "node:assert/strict";
import test from "node:test";

import { threadUpdates } from "../src/lib/autopilot/thread-updates-core.ts";

function evidence(overrides = {}) {
  return {
    id: "ev_1",
    source: "slack",
    synthetic: false,
    title: "Checkout is broken",
    body: "I cannot pay",
    author: "U123",
    url: "slack://C123/111.222",
    occurredAt: "2026-11-19T10:00:00.000Z",
    signalId: "sig_1",
    ...overrides,
  };
}

function signal(overrides = {}) {
  return {
    id: "sig_1",
    title: "Checkout payments fail",
    problem: "",
    area: "checkout",
    status: "experimenting",
    kind: "bug",
    kindReason: null,
    createdAt: "2026-11-19T10:00:00.000Z",
    updatedAt: "2026-11-19T10:00:00.000Z",
    evidence: [evidence()],
    distinctEvidence: 1,
    staleEvidence: 0,
    sources: ["slack"],
    ready: true,
    snoozedUntil: null,
    ...overrides,
  };
}

function experiment(overrides = {}) {
  return {
    id: "exp_1",
    signalId: "sig_1",
    version: 1,
    kind: "fix",
    title: "Handle declined cards",
    status: "rolled_out",
    rejectedBy: null,
    prUrl: "https://github.com/acme/app/pull/7",
    prNumber: 7,
    note: null,
    readout: null,
    coderSessionId: "session_1",
    buildStartedAt: "2026-11-19T11:00:00.000Z",
    createdAt: "2026-11-19T10:30:00.000Z",
    startedAt: "2026-11-19T11:00:00.000Z",
    verdict: "fixed",
    ...overrides,
  };
}

const input = (signals, experiments) => ({
  signals,
  experiments,
  appUrl: "https://kismet.example/",
  now: new Date("2026-11-19T12:00:00.000Z"),
});

test("a bug fix posts each stage while it is current, with stable text and keys", () => {
  const stages = (overrides) => threadUpdates(input([signal()], [experiment(overrides)])).map((update) => update.stage);
  assert.deepEqual(stages({ status: "building", prUrl: null, prNumber: null, verdict: null }), ["received", "working"]);
  assert.deepEqual(stages({ status: "awaiting_approval", verdict: null }), ["received", "working", "review"]);
  // Merged before the review update went out: the review step is skipped, not announced late.
  assert.deepEqual(stages({ status: "rolled_out", verdict: null }), ["received", "merged"]);

  const updates = threadUpdates(input([signal()], [experiment()]));
  assert.deepEqual(updates.map((update) => update.key), [
    "received:sig_1:C123:111.222",
    "reporter_reply:exp_1:C123:111.222",
    "fixed:exp_1:C123:111.222",
  ]);
  assert.deepEqual(updates.map((update) => update.text), [
    "Got it. Kismet is looking into this as a bug: “Checkout payments fail”.",
    "Merged and live: Handle declined cards (https://github.com/acme/app/pull/7). Kismet will watch for new reports over the next 14 days.",
    "Update: no new reports in the 14 days since the fix, so Kismet marked this fixed.",
  ]);
  const review = threadUpdates(input([signal()], [experiment({ status: "awaiting_approval", verdict: null })]));
  assert.equal(review[1].text, "Kismet is writing a fix: Handle declined cards. Follow along: https://kismet.example/experiments?experiment=exp_1");
  assert.equal(review[2].text, "The fix is ready for review: https://github.com/acme/app/pull/7. It ships once someone approves it in Kismet: https://kismet.example/experiments?experiment=exp_1");
});

test("an idea gets the idea-specific received update", () => {
  const [update] = threadUpdates(input([signal({ kind: "idea", title: "Add saved carts" })], []));
  assert.equal(update.text, "Got it. Kismet filed this under “Add saved carts”. It acts on ideas once a few more people ask for them, or when someone starts it in Kismet.");
});

test("a no-change outcome uses the reason from its note", () => {
  const updates = threadUpdates(input([signal()], [experiment({ status: "rejected", rejectedBy: "kismet", note: "No change needed: Stripe was unavailable.", prUrl: null, prNumber: null, coderSessionId: null, buildStartedAt: null, verdict: null })]));
  assert.equal(updates.at(-1).stage, "no_change");
  assert.equal(updates.at(-1).text, "Kismet looked into this and no change is needed: Stripe was unavailable.");
});

test("Slack-authored evidence never receives thread updates", () => {
  const slackSignal = signal({ evidence: [evidence({ author: "Slack" })] });
  assert.deepEqual(threadUpdates(input([slackSignal], [experiment()])), []);
});

test("a merged fix keeps the legacy reporter reply key", () => {
  const merged = threadUpdates(input([signal()], [experiment()])).find((update) => update.stage === "merged");
  assert.equal(merged.key, "reporter_reply:exp_1:C123:111.222");
});
