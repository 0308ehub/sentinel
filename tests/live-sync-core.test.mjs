import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatLocation,
  parseLocation,
  presenceHere,
  versionChanged,
} from "../src/lib/workspace/live-sync-core.ts";

test("formats and parses experiment locations", () => {
  assert.equal(formatLocation("/experiments", "exp_123"), "experiments:exp_123");
  assert.deepEqual(parseLocation("experiments:exp_123"), { kind: "experiment", experimentId: "exp_123" });
});

test("formats and parses page locations", () => {
  assert.equal(formatLocation("analytics"), "page:/analytics");
  assert.deepEqual(parseLocation("page:/analytics"), { kind: "page", pathname: "/analytics" });
  assert.equal(parseLocation("unknown"), null);
});

test("finds only people at the same location", () => {
  const people = [
    { userId: "a", name: "A", imageUrl: "", location: "experiments:one" },
    { userId: "b", name: "B", imageUrl: "", location: "experiments:two" },
  ];
  assert.deepEqual(presenceHere(people, "experiments:one"), [people[0]]);
});

test("detects version changes after the initial read", () => {
  assert.equal(versionChanged(null, 1), false);
  assert.equal(versionChanged(1, 1), false);
  assert.equal(versionChanged(1, 2), true);
});
