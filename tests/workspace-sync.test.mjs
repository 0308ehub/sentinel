import { test } from "node:test";
import assert from "node:assert/strict";
import { initialAction, trimForUpload } from "../src/lib/workspace/sync-plan.ts";

test("server state is adopted when it exists", () => {
  assert.equal(
    initialAction({ serverHasData: true, localEmpty: false, localOwner: null, userId: "user-a" }),
    "adopt-server",
  );
});

test("existing local state is migrated for its owner", () => {
  assert.equal(
    initialAction({ serverHasData: false, localEmpty: false, localOwner: "user-a", userId: "user-a" }),
    "push-local",
  );
});

test("another user's local state is reset", () => {
  assert.equal(
    initialAction({ serverHasData: false, localEmpty: false, localOwner: "user-b", userId: "user-a" }),
    "reset-local",
  );
});

test("empty local and server state needs no action", () => {
  assert.equal(
    initialAction({ serverHasData: false, localEmpty: true, localOwner: null, userId: "user-a" }),
    "none",
  );
});

test("trimForUpload keeps values under the byte limit", () => {
  const value = { text: "small" };
  assert.equal(trimForUpload(value, 100, () => ({ text: "slim" })), value);
});

test("trimForUpload slims values over the byte limit", () => {
  const slim = { text: "slim" };
  assert.equal(trimForUpload({ text: "🙂🙂" }, 10, () => slim), slim);
});
