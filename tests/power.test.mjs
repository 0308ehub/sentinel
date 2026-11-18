import assert from "node:assert/strict";
import test from "node:test";
import { daysToResult, perArmSampleSize } from "../src/lib/autopilot/power.ts";

test("a 10% baseline and 20% relative MDE needs about 3,800 visitors per arm", () => {
  const sample = perArmSampleSize(0.1, 0.2);
  assert.ok(Math.abs(sample - 3800) / 3800 < 0.03, String(sample));
});

test("zero traffic can never conclude", () => {
  assert.deepEqual(daysToResult({ weeklyVisitors: 0, baselineRate: 0.1, relativeMde: 0.2 }), { perArm: Infinity, days: Infinity });
});

test("zero and tiny baselines produce finite conservative estimates when traffic exists", () => {
  const zero = daysToResult({ weeklyVisitors: 1000, baselineRate: 0, relativeMde: 0.2 });
  const tiny = daysToResult({ weeklyVisitors: 1000, baselineRate: 0.00001, relativeMde: 0.2 });
  assert.ok(Number.isFinite(zero.perArm) && zero.perArm > 0);
  assert.ok(Number.isFinite(tiny.days) && tiny.days > 0);
});
