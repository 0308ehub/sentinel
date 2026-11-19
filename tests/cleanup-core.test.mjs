import assert from "node:assert/strict";
import test from "node:test";
import { codeAlreadyRemoved } from "../src/lib/autopilot/cleanup-core.ts";

test("code is already removed when changed files no longer contain the flag", () => {
  assert.equal(codeAlreadyRemoved("ap-example-v1", ["export const value = true;", null]), true);
});

test("code is not already removed when any changed file still contains the flag", () => {
  assert.equal(codeAlreadyRemoved("ap-example-v1", ["useVariant(\"ap-example-v1\")", null]), false);
});

test("an empty changed-file list is not enough to decide the code was removed", () => {
  assert.equal(codeAlreadyRemoved("ap-example-v1", []), false);
});
