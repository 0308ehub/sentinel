import { test } from "node:test";
import assert from "node:assert/strict";
import { isStateKey, STATE_KEYS } from "../src/lib/workspace/keys.ts";
import { EMPTY_ONBOARDING, normalizeOnboarding } from "../src/lib/onboarding.ts";
import { parseWorkContext } from "../src/lib/work-context.ts";
import { parseDesignDraft } from "../src/lib/design/draft.ts";

test("synced keys stay explicit", () => {
  assert.deepEqual(STATE_KEYS, [
    "graph",
    "chats",
    "context",
    "onboarding",
    "settings",
    "agents",
    "design",
    "notifications",
    "analytics",
    "notebooks",
  ]);
  assert.equal(isStateKey("design"), true);
  assert.equal(isStateKey("theme"), false);
});

test("onboarding keeps known answers and drops a bad step", () => {
  const next = normalizeOnboarding({ step: "nope", goals: ["decide", 3, "slack"], name: "Ada", started: true });
  assert.equal(next.step, "you");
  assert.deepEqual(next.goals, ["decide", "slack"]);
  assert.equal(next.name, "Ada");
  assert.equal(next.started, true);
  assert.equal(next.completed, false);
});

test("onboarding falls back when the payload is empty", () => {
  assert.deepEqual(normalizeOnboarding(null), EMPTY_ONBOARDING);
});

test("work context keeps only complete pages and notes", () => {
  const next = parseWorkContext({
    pages: [{ path: "/ai", title: "Chat", text: "Hello", at: "2026-11-16T00:00:00.000Z" }, { path: "/ai" }],
    memory: [{ at: "2026-11-16T00:00:00.000Z", summary: "Opened Chat", key: "page:/ai" }, { summary: "missing time" }],
  });
  assert.equal(next.pages.length, 1);
  assert.equal(next.memory.length, 1);
});

test("design draft keeps a real screen and drops a broken one", () => {
  const draft = parseDesignDraft({
    original: {
      id: "screen-1",
      source: "app",
      name: "Home",
      width: 960,
      height: 640,
      pieces: [{ id: "title", name: "Title", kind: "text", text: "Hello", x: 10, y: 10, w: 100, h: 40 }],
    },
    versions: [{ id: "bad" }],
    activeId: "screen-1",
    notes: [
      { id: "n1", role: "user", text: "Move the title" },
      { id: "n2", role: "nope", text: "x" },
    ],
  });
  assert.equal(draft.original?.id, "screen-1");
  assert.equal(draft.versions.length, 0);
  assert.equal(draft.notes.length, 1);
  assert.equal(draft.activeId, "screen-1");
});
