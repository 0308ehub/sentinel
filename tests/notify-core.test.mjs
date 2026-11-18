import assert from "node:assert/strict";
import test from "node:test";

import { buildDigest, deriveEvents, digestDue } from "../src/lib/autopilot/notify-core.ts";

function experiment(overrides = {}) {
  return {
    id: "exp_1",
    signalId: "sig_1",
    version: 1,
    kind: "test",
    title: "Checkout <test> & learn",
    hypothesis: "",
    metric: "conversion",
    metricSpec: null,
    guardrailSpec: null,
    page: "/checkout",
    overlap: null,
    guardrail: "",
    control: "",
    treatment: "",
    changeSummary: null,
    flag: "checkout-test",
    status: "running",
    rejectedBy: null,
    branch: null,
    prUrl: null,
    prNumber: null,
    note: null,
    readout: null,
    rationale: null,
    directional: null,
    estimate: null,
    draftPath: null,
    coderSessionId: null,
    agentFailed: false,
    builder: null,
    buildRef: null,
    buildUrl: null,
    buildStartedAt: null,
    cleanup: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    startedAt: null,
    endedAt: null,
    verifiedAt: null,
    verdict: null,
    ...overrides,
  };
}

function readout(overrides = {}) {
  return {
    arms: [
      { arm: "control", visitors: 120, conversions: 12, rate: 0.1 },
      { arm: "treatment", visitors: 130, conversions: 18, rate: 0.138 },
    ],
    lift: 0.38,
    pValue: 0.03,
    sequentialP: 0.04,
    minimumDays: 7,
    verdict: "won",
    interaction: null,
    syntheticShare: 0,
    at: "2026-11-17T00:00:00.000Z",
    ...overrides,
  };
}

test("derives approval wording for tests, changes, and fixes", () => {
  const events = deriveEvents([
    experiment({ id: "test", status: "awaiting_approval" }),
    experiment({ id: "change", kind: "change", status: "awaiting_approval" }),
    experiment({ id: "fix", kind: "fix", status: "awaiting_approval" }),
  ], "https://app.example");
  assert.deepEqual(events.map((event) => event.key), ["approval:test:v1", "approval:change:v1", "approval:fix:v1"]);
  assert.match(events[0].text, /A\/B test ready/);
  assert.match(events[1].text, /Change ready/);
  assert.match(events[2].text, /Fix PR ready/);
});

test("approval version bump produces a new key", () => {
  const first = deriveEvents([experiment({ status: "awaiting_approval" })], "https://app.example")[0];
  const next = deriveEvents([experiment({ status: "awaiting_approval", version: 2 })], "https://app.example")[0];
  assert.equal(first.key, "approval:exp_1:v1");
  assert.equal(next.key, "approval:exp_1:v2");
});

test("derives result, broken split, fix verdict, and failure events", () => {
  const result = experiment({ id: "result", status: "awaiting_rollout", readout: readout() });
  const broken = experiment({ id: "broken", readout: readout({ verdict: "collecting", srm: { pValue: 0.0001, expected: [125, 125], observed: [200, 50] }, srmLogged: true }) });
  const fixed = experiment({ id: "fixed", kind: "fix", verdict: "fixed", verifiedAt: "2026-11-17T00:00:00.000Z" });
  const reopened = experiment({ id: "reopened", kind: "fix", verdict: "not_fixed" });
  const failed = experiment({ id: "failed", status: "failed", note: "Build <failed> & stopped" });
  const events = deriveEvents([result, broken, fixed, reopened, failed], "https://app.example");
  assert.deepEqual(events.map((event) => event.key), ["result:result", "broken_split:broken", "fix_verdict:fixed", "fix_verdict:reopened", "failed:failed"]);
  assert.match(events[0].text, /\+38\.0% lift/);
  assert.match(events[0].text, /120 control \/ 130 treatment/);
  assert.match(events[2].text, /no new complaints in 14 days/);
  assert.match(events[3].text, /Complaints came back/);
});

test("does not notify ordinary running, queued, or building state", () => {
  const events = deriveEvents([
    experiment({ status: "running" }),
    experiment({ id: "queued", status: "queued" }),
    experiment({ id: "building", status: "building" }),
  ], "https://app.example");
  assert.deepEqual(events, []);
});

test("escapes user-derived mrkdwn in blocks", () => {
  const [event] = deriveEvents([experiment({ status: "failed", note: "Bad <tag> & worse > now" })], "https://app.example");
  const blockText = event.blocks[0].text.text;
  assert.match(blockText, /Bad &lt;tag&gt; &amp; worse &gt; now/);
  assert.match(blockText, /Checkout &lt;test&gt; &amp; learn/);
});

test("digestDue observes the Monday 16:00 UTC threshold and ISO week ledger", () => {
  assert.equal(digestDue(new Date("2026-11-22T18:00:00Z"), null), "2026-W47");
  assert.equal(digestDue(new Date("2026-11-23T15:59:00Z"), null), null);
  assert.equal(digestDue(new Date("2026-11-23T16:00:00Z"), null), "2026-W48");
  assert.equal(digestDue(new Date("2026-11-25T08:00:00Z"), null), "2026-W48");
  assert.equal(digestDue(new Date("2026-11-25T08:00:00Z"), "2026-W48"), null);
});

test("buildDigest returns null with no recent activity or waiting work", () => {
  assert.equal(buildDigest([], new Date("2026-11-18T12:00:00Z"), "https://app.example"), null);
  assert.equal(buildDigest([experiment()], new Date("2026-11-18T12:00:00Z"), "https://app.example"), null);
});

test("buildDigest summarizes recent activity and waiting work", () => {
  const digest = buildDigest([
    experiment({ status: "rolled_out", endedAt: "2026-11-17T12:00:00Z", readout: readout() }),
    experiment({ id: "waiting", status: "awaiting_approval" }),
    experiment({ id: "fix", kind: "fix", verdict: "fixed", verifiedAt: "2026-11-16T12:00:00Z" }),
  ], new Date("2026-11-18T12:00:00Z"), "https://app.example");
  assert.ok(digest);
  assert.match(digest.text, /Shipped: 1/);
  assert.match(digest.text, /Won: 1/);
  assert.match(digest.text, /Fixes verified: 1/);
  assert.match(digest.text, /Waiting on you: 1/);
});
