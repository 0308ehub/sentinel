import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { classifyDesignAnswer, cleanFixTitle, designSystemPrompt, fixSystemPrompt, fixTitle, normalizeDesignAnswer } from "../src/lib/autopilot/design-prompt-core.ts";

test("classifyDesignAnswer recognizes production outcomes", () => {
  assert.equal(classifyDesignAnswer({ kind: "none", reason: "No problem." }), "none");
  assert.equal(classifyDesignAnswer({ kind: "fix" }), "fix");
  assert.equal(classifyDesignAnswer({ kind: "experiment" }), "experiment");
  assert.equal(classifyDesignAnswer({ kind: "change" }), "invalid");
  assert.equal(classifyDesignAnswer({}), "invalid");
  assert.equal(classifyDesignAnswer(null), "invalid");
  assert.equal(classifyDesignAnswer("none"), "invalid");
});

test("design prompts explicitly include the none outcome", () => {
  assert.match(designSystemPrompt(), /"kind":"none"/);
  assert.match(fixSystemPrompt(), /"kind":"none"/);
});

test("eval fixtures have unique ids and known stages", () => {
  const cases = JSON.parse(fs.readFileSync(new URL("../evals/cases.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(cases));
  assert.ok(cases.length >= 12);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  for (const item of cases) assert.ok(item.stage === "triage" || item.stage === "design", `${item.id} has an unknown stage`);
});

test("design answers with lists or numbers become text", () => {
  const answer = normalizeDesignAnswer({
    title: "Show reset time",
    risks: ["Wrong timezone", "  ", "Layout shift"],
    confidence: "high",
    confidenceReason: 3,
    evidence: [{ source: "slack", quote: ["It doesn't say", "when it resets"] }],
  });
  assert.equal(answer.risks, "Wrong timezone; Layout shift");
  assert.equal(answer.confidenceReason, "3");
  assert.equal(answer.evidence[0].quote, "It doesn't say; when it resets");
  assert.equal(answer.title, "Show reset time");
});

test("fix titles never read Fix: Fix", () => {
  assert.equal(fixTitle(cleanFixTitle("Fix: Spend tab hides the reset time")), "Fix: Spend tab hides the reset time");
  assert.equal(fixTitle(cleanFixTitle("fix - Spend tab hides the reset time")), "Fix: Spend tab hides the reset time");
  assert.equal(fixTitle(cleanFixTitle("Fix-experiment builds fail when the gated file can't be read")), "Fix-experiment builds fail when the gated file can't be read");
  assert.equal(fixTitle(cleanFixTitle("Checkout button overlaps footer")), "Fix: Checkout button overlaps footer");
});
