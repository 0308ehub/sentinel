import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inverseNormalCdf,
  normalCdf,
  obrienFlemingBoundaries,
  samplesPerArm,
  srmPValue,
} from "../src/lib/lab/stats.ts";

test("normal CDF and inverse agree", () => {
  for (const p of [0.0001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.9999])
    assert.ok(Math.abs(normalCdf(inverseNormalCdf(p)) - p) < 1e-6);
});
test("binary sample size matches a known case", () =>
  assert.ok(Math.abs(samplesPerArm("binary", 0.1, undefined, 0.1, 0.05, 0.8) - 14750) < 400));
test("five-look O'Brien-Fleming boundaries match reference values", () => {
  const expected = [4.877, 3.357, 2.68, 2.29, 2.031];
  obrienFlemingBoundaries(5, 0.05).forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.02));
});
test("SRM check detects a badly split sample", () => {
  assert.ok(srmPValue([5000, 5000], [0.5, 0.5]) > 0.9);
  assert.ok(srmPValue([6000, 4000], [0.5, 0.5]) < 0.001);
});
