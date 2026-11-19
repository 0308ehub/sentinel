import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ATTEMPTS,
  buildStage,
  stageLabel,
  stallDecision,
} from "../src/lib/autopilot/build-stage-core.ts";

const step = (tool, summary) => ({ kind: "step", tool, summary, isError: false });

test("build stage follows the latest meaningful tool step", () => {
  assert.equal(buildStage([], { hasBranch: false }), "starting");
  assert.equal(buildStage([step("glob", "Searched files")], { hasBranch: false }), "reading");
  assert.equal(buildStage([step("read", "Read a file"), step("str_replace", "Changed it")], { hasBranch: false }), "writing");
  assert.equal(buildStage([step("edit", "Edited it"), step("bash", "Ran `npm test`")], { hasBranch: false }), "checking");
  assert.equal(buildStage([step("bash", "Ran `npx tsc --noEmit`")], { hasBranch: false }), "checking");
  assert.equal(buildStage([step("write", "Wrote it"), step("bash", "Ran `pwd`")], { hasBranch: false }), "writing");
  assert.equal(buildStage([step("bash", "Ran `git commit -m done && git push`")], { hasBranch: false }), "pushing");
  assert.equal(buildStage([], { hasBranch: true }), "opening_pr");
});

test("stage labels are concise user-facing descriptions", () => {
  assert.equal(stageLabel("starting"), "Starting");
  assert.equal(stageLabel("opening_pr"), "Opening the PR");
});

test("stall decision retries stalled and overlong running sessions", () => {
  const now = "2026-11-19T12:40:00.000Z";
  assert.equal(stallDecision({ status: "idle", stageAt: "2026-11-19T12:00:00.000Z", startedAt: "2026-11-19T12:00:00.000Z", attempts: 0, now }), "ok");
  assert.equal(stallDecision({ status: "running", stageAt: "2026-11-19T12:29:00.000Z", startedAt: "2026-11-19T12:10:00.000Z", attempts: 0, now }), "ok");
  assert.equal(stallDecision({ status: "rescheduling", stageAt: "2026-11-19T12:28:00.000Z", startedAt: "2026-11-19T12:10:00.000Z", attempts: 0, now }), "retry");
  assert.equal(stallDecision({ status: "running", stageAt: "2026-11-19T12:39:00.000Z", startedAt: "2026-11-19T12:00:00.000Z", attempts: 0, now }), "give_up");
  assert.equal(stallDecision({ status: "running", stageAt: "2026-11-19T12:28:00.000Z", startedAt: "2026-11-19T12:00:00.000Z", attempts: MAX_ATTEMPTS, now }), "give_up");
});
