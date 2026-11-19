import assert from "node:assert/strict";
import test from "node:test";
import { accountDailyLimitCents, activityLabel, activitySummary, combineTodaySpend, formatDollars, stackWidths, utcDays } from "../src/lib/autopilot/spend-core.ts";

test("reads the account daily limit with a $25 default", () => {
  assert.equal(accountDailyLimitCents(undefined), 2500);
  assert.equal(accountDailyLimitCents(""), 2500);
  assert.equal(accountDailyLimitCents("1200"), 1200);
  assert.equal(accountDailyLimitCents("bad"), 2500);
});

test("combines model and agent spend with a floor for unsettled sessions", () => {
  assert.equal(combineTodaySpend(75, [
    { cents: 40, settled: false },
    { cents: 180, settled: false },
    { cents: 20, settled: true },
  ]), 375);
});

test("formats cents as dollars", () => {
  assert.equal(formatDollars(0), "$0.00");
  assert.equal(formatDollars(1234), "$12.34");
});

test("unknown activity kinds roll up into Other and tick bookkeeping is skipped", () => {
  assert.deepEqual(activitySummary([{ kind: "triage", count: 2 }, { kind: "tick", count: 3 }, { kind: "cluster", count: 5 }, { kind: "new", count: 1 }]), [
    "2 problems triaged", "1 other action",
  ]);
  assert.deepEqual(activitySummary([{ kind: "tick", count: 4 }]), []);
});

test("builds UTC day buckets ending today", () => {
  assert.deepEqual(utcDays(3, new Date("2026-11-18T23:30:00-08:00")), ["2026-11-17", "2026-11-18", "2026-11-19"]);
});

test("maps activity kinds to readable singular and plural labels", () => {
  assert.equal(activityLabel("triage", 1), "1 problem triaged");
  assert.equal(activityLabel("gate", 2), "2 launch or ship decisions");
  assert.equal(activityLabel("new-kind", 3), "3 other actions");
});

test("computes proportional stack widths and handles empty days", () => {
  assert.deepEqual(stackWidths({ buildCents: 50, renderCents: 25, modelCents: 25, chatCents: 0 }), {
    build: 50, render: 25, model: 25, chat: 0,
  });
  assert.deepEqual(stackWidths({ buildCents: 0, renderCents: 0, modelCents: 0, chatCents: 0 }), {
    build: 0, render: 0, model: 0, chat: 0,
  });
});
