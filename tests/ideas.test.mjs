import assert from "node:assert/strict";
import test from "node:test";

import { buildIdeasInput, dedupeIdeas, parseIdeasResponse } from "../src/lib/autopilot/ideas-core.ts";

const idea = (title) => ({
  title,
  problem: "People cannot finish this task.",
  page: "/experiments",
  why: "Usage shows people leave this page. This should improve activation.",
  basis: ["usage: /experiments"],
});

test("parseIdeasResponse validates, trims, caps, and drops malformed ideas", () => {
  const parsed = parseIdeasResponse({ ideas: [
    { ...idea(`  ${"T".repeat(100)}  `), basis: [" usage ", 4] },
    { ...idea("Second valid idea") },
    { title: "Missing fields" },
  ] });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title.length, 80);
  assert.deepEqual(parsed[0].basis, ["usage"]);
  assert.deepEqual(parseIdeasResponse({ ideas: "nope" }), []);
});

test("dedupeIdeas rejects titles with Jaccard similarity at or above one half", () => {
  const kept = dedupeIdeas([
    idea("Experiment approval page is hard to scan"),
    idea("Improve analytics goal setup"),
    idea("Analytics goal setup needs guidance"),
  ], ["Approval experiment page hard to scan"]);
  assert.deepEqual(kept.map((item) => item.title), ["Improve analytics goal setup"]);
});

test("buildIdeasInput caps collections and truncates long strings", () => {
  const many = Array.from({ length: 100 }, (_, index) => ({ title: `${index}-${"x".repeat(700)}` }));
  const input = JSON.parse(buildIdeasInput({
    goals: many,
    learnings: many,
    themes: many,
    signals: many,
    experiments: many,
    thumbsDown: many.map((item) => item.title),
    journeys: many.map((item) => item.title),
    usage: { detail: "x".repeat(700) },
    interviews: many,
    notes: many,
    uiFiles: many.map((item) => item.title),
  }));
  assert.equal(input.goals.length, 5);
  assert.equal(input.signals.length, 80);
  assert.equal(input.uiFiles.length, 40);
  assert.equal(input.goals[0].title.length, 500);
  assert.equal(input.usage.detail.length, 500);
});
