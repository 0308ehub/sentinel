import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYTICS_FRESH_DAYS,
  ELEMENT_GONE_DAYS,
  OTHER_FRESH_DAYS,
  isElementCurrent,
  isFresh,
  otherFreshDays,
} from "../src/lib/autopilot/freshness.ts";

const now = new Date("2026-11-17T12:00:00.000Z");
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

test("analytics evidence stays fresh through its two-day boundary", () => {
  assert.equal(isFresh({ source: "analytics", occurredAt: daysAgo(ANALYTICS_FRESH_DAYS) }, now, {}), true);
  assert.equal(isFresh({ source: "analytics", occurredAt: new Date(daysAgo(ANALYTICS_FRESH_DAYS).getTime() - 1) }, now, {}), false);
});

test("other evidence stays fresh through its thirty-day boundary", () => {
  assert.equal(isFresh({ source: "slack", occurredAt: daysAgo(OTHER_FRESH_DAYS) }, now, {}), true);
  assert.equal(isFresh({ source: "ticket", occurredAt: new Date(daysAgo(OTHER_FRESH_DAYS).getTime() - 1) }, now, {}), false);
});

test("the other-source freshness window accepts a positive integer override", () => {
  const env = { AUTOPILOT_EVIDENCE_FRESH_DAYS: "7" };
  assert.equal(otherFreshDays(env), 7);
  assert.equal(isFresh({ source: "interview", occurredAt: daysAgo(7) }, now, env), true);
  assert.equal(isFresh({ source: "interview", occurredAt: daysAgo(8) }, now, env), false);
  for (const value of ["", "0", "-1", "2.5", " 7 ", "many"]) {
    assert.equal(otherFreshDays({ AUTOPILOT_EVIDENCE_FRESH_DAYS: value }), OTHER_FRESH_DAYS);
  }
});

test("elements disappear after three days without a click", () => {
  assert.equal(isElementCurrent(daysAgo(ELEMENT_GONE_DAYS), now), true);
  assert.equal(isElementCurrent(new Date(daysAgo(ELEMENT_GONE_DAYS).getTime() - 1), now), false);
});
