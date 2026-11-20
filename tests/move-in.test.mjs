import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_TABLES, movableTables, conflictPredicate } from "../src/lib/workspace/move-in-core.ts";

test("move plan excludes private coder sessions", () => {
  assert.equal(MOVE_TABLES.find((row) => row.table === "coder_sessions")?.excluded, "private");
  assert.equal(movableTables().some((row) => row.table === "coder_sessions"), false);
  assert.equal(movableTables().some((row) => row.table === "slack_mention_claims"), false);
  assert.ok(movableTables().some((row) => row.table === "connections"));
});

test("conflict plans use each table's logical account key", () => {
  assert.equal(conflictPredicate({ table: "connections", conflictKeys: ["provider"] }), "target.provider = source.provider");
  assert.equal(conflictPredicate({ table: "autopilot_repo", conflictKeys: [] }), "true");
  assert.equal(conflictPredicate({ table: "events" }), null);
});
