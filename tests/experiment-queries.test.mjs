import { test } from "node:test";
import assert from "node:assert/strict";
import { experimentQueryKeys, experimentRevision } from "../src/components/autopilot/experiment-queries.ts";

const experiment = {
  id: "exp-1",
  prNumber: 42,
  branch: "kismet/example",
  draftPath: null,
  version: 7,
  startedAt: "2026-11-19T10:00:00.000Z",
};

test("experiment revision includes every change identity field", () => {
  assert.deepEqual(experimentRevision(experiment), ["exp-1", 42, "kismet/example", null, 7]);
});

test("changes keys distinguish cleanup and revisions", () => {
  assert.notDeepEqual(experimentQueryKeys.changes(experiment), experimentQueryKeys.changes(experiment, true));
  assert.notDeepEqual(experimentQueryKeys.changes(experiment), experimentQueryKeys.changes({ ...experiment, version: 8 }));
});

test("visitor keys change when a run starts again", () => {
  assert.notDeepEqual(experimentQueryKeys.visitors(experiment), experimentQueryKeys.visitors({ ...experiment, startedAt: "2026-11-20T10:00:00.000Z" }));
});
