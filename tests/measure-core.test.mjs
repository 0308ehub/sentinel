import assert from "node:assert/strict";
import test from "node:test";
import { dailyRates, relativeLift, seriesTotals, utcDayRange } from "../src/lib/autopilot/measure-core.ts";

test("builds inclusive UTC day ranges", () => {
  assert.deepEqual(utcDayRange("2026-11-17T18:00:00Z", "2026-11-19T01:00:00Z"), ["2026-11-17", "2026-11-18", "2026-11-19"]);
});

test("turns grouped counts into rates and leaves days without visitors empty", () => {
  const rows = [
    { day: "2026-11-17", series: "control", visitors: 10, conversions: 2 },
    { day: "2026-11-17", series: "treatment", visitors: 8, conversions: 4 },
    { day: "2026-11-19", series: "control", visitors: 5, conversions: 0 },
  ];
  assert.deepEqual(dailyRates(rows, ["control", "treatment"], "2026-11-17", "2026-11-19"), [
    { day: "2026-11-17", control: 0.2, treatment: 0.5 },
    { day: "2026-11-18", control: null, treatment: null },
    { day: "2026-11-19", control: 0, treatment: null },
  ]);
});

test("totals grouped counts and computes relative lift", () => {
  const totals = seriesTotals([
    { day: "2026-11-17", series: "before", visitors: 10, conversions: 2 },
    { day: "2026-11-18", series: "before", visitors: 10, conversions: 3 },
  ], ["before", "after"]);
  assert.deepEqual(totals, {
    before: { visitors: 20, conversions: 5, rate: 0.25 },
    after: { visitors: 0, conversions: 0, rate: null },
  });
  assert.ok(Math.abs(relativeLift(0.25, 0.3) - 0.2) < 1e-12);
  assert.equal(relativeLift(0, 0.3), null);
});
