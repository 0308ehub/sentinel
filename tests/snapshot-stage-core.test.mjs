import assert from "node:assert/strict";
import test from "node:test";
import { elapsedMinutes, snapshotRefreshInterval, snapshotStage, snapshotStageLabel } from "../src/lib/autopilot/snapshot-stage-core.ts";

const step = (command, tool = "bash") => ({ kind: "step", tool, summary: command, command, isError: false });

test("snapshot stages advance from setup through both renders and checks", () => {
  assert.equal(snapshotStage([]), "setting_up");
  assert.equal(snapshotStage([step("write /mnt/session/outputs/render.mjs", "write")]), "rendering_current");
  assert.equal(snapshotStage([step("node /mnt/session/outputs/render.mjs")]), "rendering_new");
  assert.equal(snapshotStage([step("node render.mjs"), step("grep change control.html treatment.html")]), "checking");
  assert.equal(snapshotStage([], true), "ready");
});

test("snapshot stage labels are concise", () => {
  assert.equal(snapshotStageLabel("rendering_new"), "Rendering new version");
});

test("a sample keeps refreshing while it is rendering and stops when it finishes", () => {
  assert.equal(snapshotRefreshInterval("rendering"), 4_000);
  assert.equal(snapshotRefreshInterval("ready"), false);
  assert.equal(snapshotRefreshInterval("failed"), false);
  assert.equal(snapshotRefreshInterval(undefined), false);
});

test("elapsed minutes are floored and never negative", () => {
  assert.equal(elapsedMinutes("2026-01-01T00:00:00Z", "2026-01-01T00:02:59Z"), 2);
  assert.equal(elapsedMinutes("2026-01-01T00:02:00Z", "2026-01-01T00:00:00Z"), 0);
});
