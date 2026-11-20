import { test } from "node:test";
import assert from "node:assert/strict";
import { foldActivity, isAutomatedAgent } from "../src/lib/autopilot/activity-core.ts";

test("crawler and headless agents are not people", () => {
  assert.equal(isAutomatedAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isAutomatedAgent("Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36"), true);
  assert.equal(isAutomatedAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"), false);
  assert.equal(isAutomatedAgent(""), false);
  assert.equal(isAutomatedAgent(null), false);
});

test("daily rows stay per day and totals stay separate", () => {
  const activity = foldActivity(
    [
      { grain: "day", day: "2026-11-19", arm: "control", visitors: 2, views: 2, clicks: 1, conversions: 0 },
      { grain: "day", day: "2026-11-19", arm: "treatment", visitors: 1, views: 1, clicks: 1, conversions: 1 },
      { grain: "day", day: "2026-11-18", arm: "control", visitors: 4, views: 4, clicks: 0, conversions: 0 },
      { grain: "total", day: "", arm: "control", visitors: 5, views: 5, clicks: 1, conversions: 0 },
      { grain: "total", day: "", arm: "treatment", visitors: 1, views: 1, clicks: 1, conversions: 1 },
      { grain: "day", day: "2026-11-19", arm: "other", visitors: 9, views: 9, clicks: 9, conversions: 9 },
    ],
    { human: 6, synthetic: 2 },
    50,
    false,
  );
  assert.deepEqual(activity.days.map((day) => day.day), ["2026-11-18", "2026-11-19"]);
  assert.equal(activity.days[0].treatment.visitors, 0);
  assert.equal(activity.totals.control.visitors, 5);
  assert.equal(activity.totals.treatment.conversions, 1);
  assert.equal(activity.humanVisitors, 6);
  assert.equal(activity.syntheticVisitors, 2);
  assert.equal(activity.uneven, false);
});
