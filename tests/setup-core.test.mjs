import assert from "node:assert/strict";
import test from "node:test";
import { setupSteps } from "../src/lib/autopilot/setup-core.ts";

test("returns setup steps in checklist order with completion state", () => {
  assert.deepEqual(setupSteps({ slack: true, repo: false, agent: true, firstRun: false }), [
    { key: "slack", done: true },
    { key: "repo", done: false },
    { key: "agent", done: true },
    { key: "firstRun", done: false },
  ]);
});
