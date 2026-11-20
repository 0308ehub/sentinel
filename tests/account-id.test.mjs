import assert from "node:assert/strict";
import test from "node:test";
import { accountIdFor } from "../src/lib/connections/current-core.ts";

test("an active organization is the account", () => {
  assert.equal(accountIdFor({ userId: "user_1", orgId: "org_1" }), "org_1");
});

test("personal use falls back to the person", () => {
  assert.equal(accountIdFor({ userId: "user_1", orgId: null }), "user_1");
  assert.equal(accountIdFor({ userId: null, orgId: null }), null);
});
