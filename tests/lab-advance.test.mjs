import test from "node:test";
import assert from "node:assert/strict";
import { advance } from "../src/lib/lab/advance.ts";
import { SCENARIOS } from "../src/lib/lab/company.ts";
import { designExperiment } from "../src/lib/lab/design.ts";
import { PANTRY } from "../src/lib/lab/company.ts";

function running(key, launch = 4) {
  const scenario = SCENARIOS[key];
  return {
    id: scenario.proposal.id,
    proposal: scenario.proposal,
    design: designExperiment(scenario.proposal, PANTRY),
    stage: "running",
    launchedDay: launch,
    stopDay: null,
    stopReason: null,
    seed: 18,
    truthKey: key,
    run: null,
    readout: null,
    ship: null,
    updates: [],
    queuedBehind: null,
  };
}
test("advance reveals relative updates as global days and builds a decision", () => {
  const experiment = running("savePrompt");
  const state = { clock: { day: 4, playing: false, speed: 4 }, experiments: [experiment], feed: [] };
  const first = advance(state, 4);
  assert.equal(first.experiments[0].updates[0].day, 4);
  const done = advance(first, 40);
  assert.equal(done.experiments[0].stage, "shipping");
  assert.equal(done.experiments[0].stopReason, "efficacy");
  assert.ok(done.experiments[0].readout);
});

test("advance starts queued conflicting work when blocker stops", () => {
  const blocker = running("savePrompt", 1);
  const queuedBase = running("thirdSavePaywall", 1);
  const queued = { ...queuedBase, stage: "queued", launchedDay: null, queuedBehind: blocker.id };
  const state = { clock: { day: 1, playing: false, speed: 4 }, experiments: [blocker, queued], feed: [] };
  const next = advance(state, 30);
  assert.equal(next.experiments[1].stage, "running");
  assert.equal(next.experiments[1].launchedDay, 30);
  assert.match(next.experiments[1].updates[0].body, /Starting this test/);
});
