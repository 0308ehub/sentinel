import assert from "node:assert/strict";
import test from "node:test";
import { tickTriggerDue } from "../src/lib/autopilot/tick-trigger-core.ts";

test("a newly filed item triggers a tick unless the last run was under five minutes ago", () => {
  const now = "2026-11-19T12:10:00.000Z";
  assert.equal(tickTriggerDue(null, now), true);
  assert.equal(tickTriggerDue("2026-11-19T12:06:00.001Z", now), false);
  assert.equal(tickTriggerDue("2026-11-19T12:05:00.000Z", now), true);
});
