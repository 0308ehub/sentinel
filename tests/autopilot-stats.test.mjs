import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRates, sequentialDecreasePValue, sequentialPValue, srmCheck } from "../src/lib/autopilot/stats.ts";

test("classic rate comparison matches a known two-proportion result", () => {
  const result = compareRates({ visitors: 1000, conversions: 100 }, { visitors: 1000, conversions: 130 });
  assert.ok(Math.abs(result.lift - 0.3) < 1e-12);
  assert.ok(Math.abs(result.pValue - 0.0355) < 0.001);
});

test("SRM check matches known one-degree-of-freedom values", () => {
  assert.ok(srmCheck(500, 500, 0.5).pValue > 0.999999);
  assert.ok(Math.abs(srmCheck(60, 40, 0.5).pValue - 0.0455) < 0.001);
  assert.ok(srmCheck(600, 400, 0.5).pValue < 0.001);
});

test("mSPRT detects a strong effect and its one-sided direction", () => {
  const control = { visitors: 5000, conversions: 500 };
  const treatment = { visitors: 5000, conversions: 750 };
  assert.ok(sequentialPValue(control, treatment, 0.0004) < 0.05);
  assert.ok(sequentialDecreasePValue(treatment, control, 0.0004) < 0.05);
  assert.equal(sequentialDecreasePValue(control, treatment, 0.0004), 1);
});

test("mSPRT does not create excess false winners across repeated peeks", () => {
  let state = 0x5eed1234;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  let falsePositives = 0;
  const runs = 200;
  for (let run = 0; run < runs; run += 1) {
    let controlConversions = 0;
    let treatmentConversions = 0;
    let minimumP = 1;
    for (let look = 1; look <= 20; look += 1) {
      for (let visitor = 0; visitor < 100; visitor += 1) {
        if (random() < 0.1) controlConversions += 1;
        if (random() < 0.1) treatmentConversions += 1;
      }
      const current = sequentialPValue(
        { visitors: look * 100, conversions: controlConversions },
        { visitors: look * 100, conversions: treatmentConversions },
        0.0004,
      );
      if (current != null) minimumP = Math.min(minimumP, current);
    }
    if (minimumP < 0.05) falsePositives += 1;
  }
  assert.ok(falsePositives / runs < 0.07, `false-positive rate was ${falsePositives / runs}`);
});
