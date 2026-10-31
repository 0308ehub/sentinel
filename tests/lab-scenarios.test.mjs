import { test } from "node:test";
import assert from "node:assert/strict";
import { PANTRY, SCENARIOS } from "../src/lib/lab/company.ts";
import { designExperiment } from "../src/lib/lab/design.ts";
import { runExperiment } from "../src/lib/lab/monitor.ts";
import { buildReadout } from "../src/lib/lab/readout.ts";

const run = (scenario, seed = 18) => {
  const design = designExperiment(scenario.proposal, PANTRY);
  const result = runExperiment(design, scenario.truth, seed, PANTRY);
  const readout = buildReadout(design, result.looks.at(-1), result.stopReason, PANTRY);
  return { design, result, readout };
};
test("hero scenario wins at look three and includes new users", () => {
  const x = run(SCENARIOS.savePrompt);
  assert.equal(x.result.stopReason, "efficacy");
  assert.equal(x.result.looks.length, 3);
  assert.ok(x.readout.shipSegments.includes("new"));
});
test("second ad is stopped for harm", () => {
  const x = run(SCENARIOS.secondAd);
  assert.equal(x.result.stopReason, "harm");
  assert.equal(x.readout.recommendation, "kill");
});
test("sticky checklist stops for futility", () => {
  const x = run(SCENARIOS.stickyChecklist);
  assert.equal(x.result.stopReason, "futility");
  assert.equal(x.readout.recommendation, "iterate");
});
test("null simulations keep sequential false positives bounded", () => {
  let wins = 0;
  for (let seed = 1; seed <= 50; seed++)
    if (
      runExperiment(designExperiment(SCENARIOS.stickyChecklist.proposal, PANTRY), {}, seed, PANTRY).stopReason ===
      "efficacy"
    )
      wins++;
  assert.ok(wins / 50 <= 0.08, `false positive rate was ${wins / 50}`);
});

test("a revenue win that hurts return visits never ships, whatever the seed", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const x = run(SCENARIOS.secondAd, seed);
    assert.ok(!["ship_all", "ship_segment"].includes(x.readout.recommendation), `seed ${seed} shipped the second ad`);
  }
});

test("a harmless change rarely trips a guardrail", () => {
  let stops = 0;
  for (let seed = 1; seed <= 50; seed++) if (run(SCENARIOS.stickyChecklist, seed).result.stopReason === "harm") stops++;
  assert.ok(stops <= 3, `${stops} of 50 null runs stopped for harm`);
});
