import { test } from "node:test";
import assert from "node:assert/strict";
import { PANTRY, SCENARIOS } from "../src/lib/lab/company.ts";
import { designExperiment } from "../src/lib/lab/design.ts";

test("designs use whole weeks within the allowed window", () => {
  for (const scenario of Object.values(SCENARIOS)) {
    const design = designExperiment(scenario.proposal, PANTRY);
    assert.ok(design.durationDays >= 7 && design.durationDays <= 28);
    assert.equal(design.durationDays % 7, 0);
    assert.equal(design.looks, 5);
  }
});
test("proposals that edit the same file conflict, others run side by side", () => {
  assert.equal(PANTRY.conflicts(SCENARIOS.savePrompt.proposal, SCENARIOS.thirdSavePaywall.proposal), true);
  assert.equal(PANTRY.conflicts(SCENARIOS.savePrompt.proposal, SCENARIOS.secondAd.proposal), false);
  assert.equal(PANTRY.conflicts(SCENARIOS.secondAd.proposal, SCENARIOS.stickyChecklist.proposal), false);
});
