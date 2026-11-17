import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceFromGraph } from "../src/lib/autopilot/workspace-evidence.ts";

const bug = {
  id: "bug-login",
  type: "ENGINEERING_TASK",
  title: "Login fails on the second try",
  description: "The button stays disabled.",
  metadata: { kind: "bug", page: "/sign-in", repro: "Sign in, sign out, sign in again." },
  tags: ["bug"],
  createdAt: "2026-11-16T12:00:00.000Z",
};

test("a filed bug becomes evidence tied to its graph node", () => {
  const [item] = evidenceFromGraph({ nodes: [bug] });
  assert.equal(item.source, "ticket");
  assert.equal(item.title, "Login fails on the second try");
  assert.equal(item.url, "kismet://node/bug-login");
  assert.match(item.body, /Seen on \/sign-in/);
  assert.equal(item.occurredAt, "2026-11-16T12:00:00.000Z");
});

test("a customer problem is evidence and an ordinary task is not", () => {
  const items = evidenceFromGraph({
    nodes: [
      { id: "problem-1", type: "CUSTOMER_PROBLEM", title: "People cannot find the export", description: "It is buried.", createdAt: "2026-11-16T13:00:00.000Z" },
      { id: "task-1", type: "ENGINEERING_TASK", title: "Rename the button", metadata: { kind: "task" }, tags: [], createdAt: "2026-11-16T14:00:00.000Z" },
      { id: "feature-1", type: "FEATURE", title: "Export", createdAt: "2026-11-16T15:00:00.000Z" },
    ],
  });
  assert.deepEqual(items.map((item) => item.title), ["People cannot find the export"]);
  assert.match(items[0].body, /Customer problem/);
});

test("a graph without nodes contributes nothing", () => {
  assert.deepEqual(evidenceFromGraph(null), []);
  assert.deepEqual(evidenceFromGraph({ nodes: "nope" }), []);
});
