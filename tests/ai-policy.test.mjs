import assert from "node:assert/strict";
import test from "node:test";

import { chooseModel } from "../src/lib/ai/policy.ts";

const base = { needsTools: false, deep: false, claudeReady: true, openaiReady: true, policy: "auto", claudeModel: "claude-opus-5-5", openaiModel: "gpt-5.5" };

test("auto routes Kismet's triage and design calls to Claude", () => {
  assert.equal(chooseModel({ ...base, task: "experiment" }).provider, "claude");
});

test("short feature drafts still use OpenAI under auto", () => {
  assert.equal(chooseModel({ ...base, task: "feature-draft" }).provider, "openai");
});

test("an explicit OpenAI policy still wins for experiment calls", () => {
  assert.equal(chooseModel({ ...base, task: "experiment", policy: "openai" }).provider, "openai");
});
