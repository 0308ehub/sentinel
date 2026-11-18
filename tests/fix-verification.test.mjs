import assert from "node:assert/strict";
import test from "node:test";

import { decideFixVerification } from "../src/lib/autopilot/fix-verification.ts";

const startedAt = "2026-01-01T00:00:00.000Z";

test("a fix is not fixed after complaints from two people", () => {
  assert.deepEqual(decideFixVerification({ startedAt, now: "2026-01-03T00:00:00.000Z", complaints: [{ author: "Ada" }, { author: "Ben" }, { author: "Ada" }] }), { verdict: "not_fixed", complaints: 3 });
});

test("a fix is fixed after fourteen quiet days", () => {
  assert.deepEqual(decideFixVerification({ startedAt, now: "2026-01-15T00:00:00.000Z", complaints: [] }), { verdict: "fixed", complaints: 0 });
});

test("a fix remains under observation otherwise", () => {
  assert.equal(decideFixVerification({ startedAt, now: "2026-01-15T00:00:00.000Z", complaints: [{ author: "Ada" }] }), null);
  assert.equal(decideFixVerification({ startedAt, now: "2026-01-10T00:00:00.000Z", complaints: [] }), null);
});
