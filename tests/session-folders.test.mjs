import assert from "node:assert/strict";
import test from "node:test";

import { addFolder, groupedSessions, moveToFolder, parseFolders, removeFolder } from "../src/lib/autopilot/session-folders.ts";

test("parseFolders drops broken folders and memberships that point nowhere", () => {
  const state = parseFolders(JSON.stringify({
    folders: [{ id: "f1", name: "Ship", open: false }, { id: "", name: "nope" }, { name: "missing id" }],
    membership: { exp_1: "f1", exp_2: "missing" },
  }));
  assert.deepEqual(state.folders, [{ id: "f1", name: "Ship", open: false }]);
  assert.deepEqual(state.membership, { exp_1: "f1" });
});

test("groupedSessions keeps folder order and leaves the rest loose", () => {
  const state = moveToFolder(
    addFolder({ folders: [], membership: {} }, "Ship", "f1"),
    "exp_b",
    "f1",
  );
  const grouped = groupedSessions(
    [{ id: "exp_a" }, { id: "exp_b" }, { id: "exp_c" }],
    state,
  );
  assert.deepEqual(grouped.folders.map((group) => group.items.map((item) => item.id)), [["exp_b"]]);
  assert.deepEqual(grouped.loose.map((item) => item.id), ["exp_a", "exp_c"]);
});

test("removeFolder returns its sessions to the loose list", () => {
  const grouped = groupedSessions(
    [{ id: "exp_b" }],
    removeFolder(moveToFolder(addFolder({ folders: [], membership: {} }, "Ship", "f1"), "exp_b", "f1"), "f1"),
  );
  assert.deepEqual(grouped.folders, []);
  assert.deepEqual(grouped.loose, [{ id: "exp_b" }]);
});
