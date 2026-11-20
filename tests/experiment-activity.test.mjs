import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { foldActivity } from "../src/lib/autopilot/activity-core.ts";
import { isBotUserAgent } from "../src/lib/autopilot/traffic-core.ts";

test("folds totals separately from daily points", () => {
  const activity = foldActivity([
    { grain: "total", day: "", arm: "control", visitors: 2, views: 2, clicks: 1, conversions: 1 },
    { grain: "total", day: "", arm: "treatment", visitors: 1, views: 1, clicks: 0, conversions: 0 },
    { grain: "day", day: "2026-11-19", arm: "control", visitors: 2, views: 2, clicks: 1, conversions: 1 },
    { grain: "day", day: "2026-11-19", arm: "treatment", visitors: 1, views: 1, clicks: 0, conversions: 0 },
    { grain: "day", day: "2026-11-18", arm: "other", visitors: 9, views: 9, clicks: 9, conversions: 9 },
  ], { human: 3, synthetic: 40 }, 50, false);
  assert.equal(activity.humanVisitors, 3);
  assert.equal(activity.syntheticVisitors, 40);
  assert.equal(activity.treatmentPct, 50);
  assert.equal(activity.uneven, false);
  assert.deepEqual(activity.totals.control, { visitors: 2, views: 2, clicks: 1, conversions: 1 });
  assert.equal(activity.totals.treatment.visitors, 1);
  assert.deepEqual(activity.days.map((day) => day.day), ["2026-11-19"]);
  assert.equal(activity.days[0].treatment.visitors, 1);
});

test("an empty run still has both versions", () => {
  const activity = foldActivity([], { human: 0, synthetic: 0 }, 50);
  assert.deepEqual(activity.totals.control, { visitors: 0, views: 0, clicks: 0, conversions: 0 });
  assert.deepEqual(activity.totals.treatment, { visitors: 0, views: 0, clicks: 0, conversions: 0 });
  assert.deepEqual(activity.days, []);
});

test("crawler user agents are bots and browsers are not", () => {
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36"), true);
  assert.equal(isBotUserAgent("curl/8.4.0"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"), false);
  assert.equal(isBotUserAgent("node"), false);
  assert.equal(isBotUserAgent(""), false);
  assert.equal(isBotUserAgent(null), false);
});

test("browser clicks wait until the visitor has an experiment version", async () => {
  const source = await readFile(new URL("../public/kismet.js", import.meta.url), "utf8");
  assert.match(source, /ready\.then\(function \(\) \{ record\("click", page, label\); \}\)/);
  assert.match(source, /automated: automated/);
});
