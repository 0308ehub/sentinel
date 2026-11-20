import assert from "node:assert/strict";
import test from "node:test";
import { startOfMonth, wonSince } from "../src/lib/autopilot/won-core.ts";

test("start of month is local midnight on the first", () => {
  const now = new Date(2026, 10, 19, 15, 30).getTime();
  assert.equal(startOfMonth(now), new Date(2026, 10, 1).getTime());
});

test("counts only winners declared since the start of the month", () => {
  const since = new Date(2026, 10, 1).getTime();
  const at = (date) => date.toISOString();
  const experiments = [
    { readout: { verdict: "won", at: at(new Date(2026, 10, 3)) } },
    { readout: { verdict: "won", at: at(new Date(2026, 10, 1)) } },
    { readout: { verdict: "won", at: at(new Date(2026, 9, 31, 23, 59)) } },
    { readout: { verdict: "lost", at: at(new Date(2026, 10, 5)) } },
    { readout: { verdict: "collecting", at: at(new Date(2026, 10, 5)) } },
    { readout: null },
  ];
  assert.equal(experiments.filter((experiment) => wonSince(experiment, since)).length, 2);
});
