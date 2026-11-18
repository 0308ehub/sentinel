import assert from "node:assert/strict";
import test from "node:test";
import { SIGN_IN_DESTINATION, SIGN_UP_DESTINATION, isExistingAccount } from "../src/lib/auth/destinations.ts";

const hour = 60 * 60 * 1000;
const now = Date.parse("2026-11-17T20:00:00Z");

test("sign-up and sign-in open different places", () => {
  assert.equal(SIGN_UP_DESTINATION, "/onboarding/you");
  assert.equal(SIGN_IN_DESTINATION, "/ai");
  assert.notEqual(SIGN_IN_DESTINATION, SIGN_UP_DESTINATION);
});

test("an account created before this hour is already signed up", () => {
  assert.equal(isExistingAccount(new Date(now - hour - 1), now), true);
  assert.equal(isExistingAccount(new Date(now - 5 * 60 * 1000), now), false);
  assert.equal(isExistingAccount(null, now), false);
});
