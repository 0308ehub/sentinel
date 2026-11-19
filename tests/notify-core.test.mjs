import assert from "node:assert/strict";
import test from "node:test";

import { alertDue, buildDigest, deriveEvents, digestDue, failureStreak, reporterReplyKey, reporterReplyText, reporterThreads } from "../src/lib/autopilot/notify-core.ts";

test("counts only the newest consecutive failing ticks", () => {
  assert.equal(failureStreak(["Ran with 2 error(s).", "Ran with 1 error(s).", "Ran.", "Ran with 4 error(s)."]), 2);
});

test("alerts at three failures with a stable key for the streak", () => {
  const ticks = [
    { message: "Ran with 1 error(s).", at: "2026-11-19T03:00:00.000Z" },
    { message: "Ran with 2 error(s).", at: "2026-11-19T02:00:00.000Z" },
    { message: "Ran with 1 error(s).", at: "2026-11-19T01:00:00.000Z" },
  ];
  assert.deepEqual(alertDue(ticks), { key: "tick_failing:2026-11-19T01:00:00.000Z", streak: 3 });
  assert.equal(alertDue(ticks.slice(0, 2)), null);
});

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

test("picks and deduplicates up to five Slack reporter threads", () => {
  const evidence = [
    { source: "slack", author: "U1", url: "slack://C1/111.1" },
    { source: "slack", author: "U1", url: "slack://C1/111.1" },
    { source: "ticket", author: "U1", url: "slack://C2/222.2" },
    { source: "slack", author: "U1", url: "https://example.com" },
    ...[2, 3, 4, 5, 6].map((value) => ({ source: "slack", author: `U${value}`, url: `slack://C${value}/${value}.0` })),
  ];
  assert.deepEqual(reporterThreads(evidence), [
    { channelId: "C1", threadTs: "111.1" },
    { channelId: "C2", threadTs: "2.0" },
    { channelId: "C3", threadTs: "3.0" },
    { channelId: "C4", threadTs: "4.0" },
    { channelId: "C5", threadTs: "5.0" },
  ]);
});

test("builds the reporter reply and stable dedupe key", () => {
  assert.equal(reporterReplyKey("exp_1", "C1", "111.1"), "reporter_reply:exp_1:C1:111.1");
  assert.equal(
    reporterReplyText("Fix checkout", "https://github.com/acme/app/pull/7"),
    "Thanks for flagging this. A fix is live: Fix checkout (https://github.com/acme/app/pull/7). Kismet will keep an eye out for new reports.",
  );
});

test("never replies to evidence Kismet's own Slack posts produced", () => {
  assert.deepEqual(reporterThreads([
    { source: "slack", author: "Slack", url: "slack://C1/1.0" },
    { source: "slack", author: "", url: "slack://C1/2.0" },
    { source: "slack", author: "U9", url: "slack://C1/3.0" },
  ]), [{ channelId: "C1", threadTs: "3.0" }]);
});
