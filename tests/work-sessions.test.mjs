import assert from "node:assert/strict";
import test from "node:test";
import { workSession } from "../src/lib/autopilot/work-sessions.ts";

const now = Date.parse("2026-11-18T20:00:00.000Z");

function experiment(patch) {
  return {
    id: "exp-1",
    title: "Homepage banner",
    hypothesis: "A clearer banner increases purchases.",
    page: "/home",
    status: "building",
    kind: "test",
    note: null,
    prUrl: null,
    prNumber: null,
    draftPath: null,
    createdAt: "2026-11-18T19:00:00.000Z",
    startedAt: null,
    endedAt: null,
    buildStartedAt: "2026-11-18T19:04:00.000Z",
    estimate: null,
    readout: null,
    directional: null,
    rollout: null,
    cleanup: null,
    ...patch,
  };
}

test("a build in progress is working", () => {
  const session = workSession(experiment({}), now);
  assert.equal(session.bucket, "working");
  assert.equal(session.mark, "dashed");
  assert.equal(session.line.text, "Working · 56 min");
  assert.equal(session.clock, true);
  assert.equal(session.canStop, true);
});

test("an open pull request still waiting on its preview is ready", () => {
  const session = workSession(experiment({
    status: "awaiting_approval",
    prUrl: "https://github.com/acme/app/pull/12",
    prNumber: 12,
    note: "Changes src/app/page.tsx. Waiting for the preview build.",
  }), now);
  assert.equal(session.line.text, "PR is ready");
  assert.equal(session.line.tone, "green");
  assert.equal(session.pulls, 1);
  assert.equal(session.bucket, "ready");
});

test("a pull request whose preview passed needs a review", () => {
  const session = workSession(experiment({
    status: "awaiting_approval",
    prUrl: "https://github.com/acme/app/pull/12",
    prNumber: 12,
    note: "Preview build passed.",
    cleanup: { status: "awaiting", prUrl: "https://github.com/acme/app/pull/13" },
  }), now);
  assert.equal(session.line.text, "Review PR");
  assert.equal(session.line.tone, "orange");
  assert.equal(session.mark, "blue");
  assert.equal(session.followUps, 1);
});

test("a running test shows how far the readout has gotten", () => {
  const session = workSession(experiment({
    status: "running",
    startedAt: "2026-11-11T20:00:00.000Z",
    kind: "test",
    estimate: { perArm: 1000, days: 14 },
    readout: { arms: [{ visitors: 400 }, { visitors: 400 }] },
  }), now);
  assert.equal(session.line.text, "Running · 40%");
  assert.equal(session.mark, "blue");
  assert.equal(session.bucket, "running");
});

test("a merged cleanup is no longer an active review session", () => {
  const session = workSession(experiment({
    status: "rolled_out",
    cleanup: { status: "merged", prUrl: "https://github.com/acme/app/pull/13" },
  }), now);
  assert.equal(session.bucket, "quiet");
  assert.equal(session.followUps, 0);
});
