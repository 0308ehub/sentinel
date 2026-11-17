import { test } from "node:test";
import assert from "node:assert/strict";
import { commitCharge, estimateCents, releaseCharge, reserveCents } from "../src/lib/ai/budget-math.ts";

const limits = { perMinute: 2, userDaily: 10, globalDaily: 15 };

test("a model call costs at least one cent and grows with the prompt", () => {
  assert.equal(estimateCents(10, 10), 1);
  assert.ok(estimateCents(80_000, 8_000) > estimateCents(100, 100));
  assert.ok(reserveCents(1_000) >= 1);
});

test("the minute cap stops a burst before the daily cap", () => {
  const ledger = new Map();
  const charge = { user: "user:a", day: "day:2026-11-07", minute: "min:2026-11-07T20:00", cents: 1 };
  assert.equal(commitCharge(ledger, charge, limits), null);
  assert.equal(commitCharge(ledger, charge, limits), null);
  assert.match(commitCharge(ledger, charge, limits), /Wait a minute/);
});

test("the account cap and the site cap refuse once the cents are used", () => {
  const ledger = new Map();
  const charge = { user: "user:a", day: "day:2026-11-07", minute: "min:2026-11-07T20:01", cents: 8 };
  assert.equal(commitCharge(ledger, charge, limits), null);
  assert.match(commitCharge(ledger, { ...charge, minute: "min:2026-11-07T20:02" }, limits), /account/);
  releaseCharge(ledger, charge);
  const other = { user: "user:b", day: charge.day, minute: "min:2026-11-07T20:03", cents: 8 };
  assert.equal(commitCharge(ledger, other, limits), null);
  assert.match(
    commitCharge(ledger, { ...other, user: "user:c", minute: "min:2026-11-07T20:04" }, limits),
    /Kismet hit its daily model budget/,
  );
});

test("a refused charge does not stick", () => {
  const ledger = new Map();
  const charge = { user: "user:a", day: "day:2026-11-07", minute: "min:2026-11-07T20:00", cents: 1 };
  commitCharge(ledger, charge, limits);
  commitCharge(ledger, charge, limits);
  commitCharge(ledger, charge, limits);
  releaseCharge(ledger, charge);
  assert.equal(commitCharge(ledger, { ...charge, minute: "min:2026-11-07T20:05" }, limits), null);
});
