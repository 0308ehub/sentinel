import assert from "node:assert/strict";
import test from "node:test";
import { autopilotUser, tickUsers, withAutopilotUser } from "../src/lib/autopilot/scope.ts";

test("a tick keeps its account when another tick is nested", async () => {
  await withAutopilotUser("user-a", async () => {
    assert.equal(autopilotUser(), "user-a");
    await withAutopilotUser("user-b", async () => {
      assert.equal(autopilotUser(), "user-b");
    });
    assert.equal(autopilotUser(), "user-a");
  });
});

test("cron runs each github account, and falls back only when none are connected", () => {
  assert.deepEqual(tickUsers([" user-a ", "user-a", "user-b"], "owner"), ["user-a", "user-b"]);
  assert.deepEqual(tickUsers([], "owner"), ["owner"]);
  assert.deepEqual(tickUsers(["", "  "], null), []);
});
