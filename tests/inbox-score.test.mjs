import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dampenTier,
  isHeldBack,
  judge,
  nextWeight,
  rawScore,
  selectDelivery,
  shouldOpenSession,
  tierForScore,
  withinWorkingHours,
} from "../src/lib/inbox/score.ts";

const base = { evidence: 0.8, impact: 0.8, urgency: 0.8, relevance: 1, interruptionCost: 0.05 };

test("score is the product of the four factors minus interruption cost", () => {
  assert.equal(rawScore(base), 0.8 * 0.8 * 0.8 - 0.05);
});

test("tiers follow the score", () => {
  assert.equal(tierForScore(0.02), "LOG");
  assert.equal(tierForScore(0.15), "DIGEST");
  assert.equal(tierForScore(0.4), "NUDGE");
  assert.equal(tierForScore(0.7), "INTERRUPT");
});

test("dismissing a type lowers the next score enough to change the tier", () => {
  const near = { evidence: 0.7, impact: 0.7, urgency: 0.7, interruptionCost: 0.05, relevance: 1 };
  const before = judge({ ...near, id: "a", ignoredStreak: 0, muted: false, interruptsLeft: 3 });
  const after = judge({
    ...near,
    relevance: nextWeight(1, "dismiss"),
    id: "b",
    ignoredStreak: 0,
    muted: false,
    interruptsLeft: 3,
  });
  assert.equal(before.tier, "NUDGE");
  assert.ok(after.score < before.score);
  assert.equal(after.tier, "DIGEST");
});

test("three ignored texts drop the agent's next send a tier", () => {
  assert.equal(dampenTier("NUDGE", 3), "DIGEST");
  assert.equal(dampenTier("INTERRUPT", 6), "DIGEST");
  const judged = judge({ ...base, evidence: 0.95, impact: 0.95, urgency: 0.95, id: "c", ignoredStreak: 3, muted: false, interruptsLeft: 3 });
  assert.equal(judged.tier, "NUDGE");
  assert.match(judged.explanation, /Ignored 3 times/);
});

test("a used interruption budget does not send another interrupt", () => {
  const judged = judge({ ...base, evidence: 0.95, impact: 0.95, urgency: 0.95, id: "d", ignoredStreak: 0, muted: false, interruptsLeft: 0 });
  assert.equal(judged.tier, "NUDGE");
  assert.match(judged.explanation, /budget/);
});

test("a session start with nothing worth sending delivers nothing", () => {
  const quiet = [
    { id: "1", score: 0.02, tier: "LOG" },
    { id: "2", score: 0.04, tier: "LOG" },
  ];
  const sent = selectDelivery(quiet, { mode: "session", withinHours: true, sessionStart: true, cap: 4, interruptsLeft: 3 });
  assert.deepEqual(sent, []);
});

test("a session start stays inside the cap and keeps the strongest items", () => {
  const items = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), score: n / 10, tier: "DIGEST" }));
  const sent = selectDelivery(items, { mode: "session", withinHours: true, sessionStart: true, cap: 4, interruptsLeft: 3 });
  assert.deepEqual(sent.map((item) => item.id), ["5", "4", "3", "2"]);
});

test("opening the app does not start a session", () => {
  const now = Date.parse("2026-11-05T18:00:00Z");
  assert.equal(
    shouldOpenSession({ kind: "page", lastAt: null, now, idleMs: 2 * 60 * 60 * 1000, withinHours: true, mode: "session" }),
    false,
  );
});

test("real work after the idle gap starts a session, and work inside the gap does not", () => {
  const now = Date.parse("2026-11-05T18:00:00Z");
  const idleMs = 2 * 60 * 60 * 1000;
  assert.equal(shouldOpenSession({ kind: "edit", lastAt: null, now, idleMs, withinHours: true, mode: "session" }), true);
  assert.equal(shouldOpenSession({ kind: "reply", lastAt: now - idleMs + 1000, now, idleMs, withinHours: true, mode: "session" }), false);
  assert.equal(shouldOpenSession({ kind: "card", lastAt: now - idleMs, now, idleMs, withinHours: true, mode: "session" }), true);
  assert.equal(shouldOpenSession({ kind: "edit", lastAt: now - idleMs - 1, now, idleMs, withinHours: false, mode: "session" }), false);
});

test("outside working hours nothing is delivered unless the mode is always", () => {
  const items = [{ id: "1", score: 0.9, tier: "INTERRUPT" }];
  assert.deepEqual(selectDelivery(items, { mode: "hours", withinHours: false, sessionStart: true, cap: 4, interruptsLeft: 3 }), []);
  assert.equal(selectDelivery(items, { mode: "always", withinHours: false, sessionStart: true, cap: 4, interruptsLeft: 1 }).length, 1);
});

test("session mode holds nudges until the next session start", () => {
  const items = [{ id: "1", score: 0.4, tier: "NUDGE" }];
  assert.deepEqual(selectDelivery(items, { mode: "session", withinHours: true, sessionStart: false, cap: 4, interruptsLeft: 3 }), []);
});

test("snoozed and already sent signals are not sent again", () => {
  const now = 1_000;
  const sent = { ids: new Set(["sent-id"]), keys: new Set(["sent-key"]) };
  assert.equal(isHeldBack({ id: "new", semanticKey: "sent-key", snoozeUntil: null }, sent, now), true);
  assert.equal(isHeldBack({ id: "sent-id", semanticKey: "other", snoozeUntil: null }, sent, now), true);
  assert.equal(isHeldBack({ id: "new", semanticKey: "fresh", snoozeUntil: now + 10 }, sent, now), true);
  assert.equal(isHeldBack({ id: "new", semanticKey: "fresh", snoozeUntil: now - 10 }, sent, now), false);
});

test("working hours follow the stored clock", () => {
  const morning = new Date("2026-11-05T15:00:00Z");
  assert.equal(withinWorkingHours(morning, 9, 18, -480), false);
  const afternoon = new Date("2026-11-05T20:00:00Z");
  assert.equal(withinWorkingHours(afternoon, 9, 18, -480), true);
});
