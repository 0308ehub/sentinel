import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Anthropic from "@anthropic-ai/sdk";

import { chooseModel, readPolicy } from "../src/lib/ai/policy.ts";
import { designSystemPrompt, designUserMessage, classifyDesignAnswer } from "../src/lib/autopilot/design-prompt-core.ts";
import { triageInput, triageSystemPrompt } from "../src/lib/autopilot/triage-prompt-core.ts";
import { parseTriageResults } from "../src/lib/autopilot/triage-core.ts";

const root = path.resolve(import.meta.dirname, "..");
await loadEnvLocal(path.join(root, ".env.local"));

const options = parseArgs(process.argv.slice(2));
const allCases = JSON.parse(await fs.readFile(path.join(root, "evals/cases.json"), "utf8"));
const cases = allCases.filter((item) => (!options.only || item.id === options.only) && (!options.stage || item.stage === options.stage));
if (cases.length === 0) throw new Error("No eval cases matched the requested filters.");
const claudeKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
if (options.provider === "claude" && !claudeKey) throw new Error("ANTHROPIC_API_KEY is required for --provider claude.");
if (options.provider === "openai" && !openaiKey) throw new Error("OPENAI_API_KEY is required for --provider openai.");
const decision = chooseModel({
  task: "experiment",
  needsTools: false,
  deep: false,
  claudeReady: Boolean(claudeKey),
  openaiReady: Boolean(openaiKey),
  policy: readPolicy(process.env.KISMET_MODEL_POLICY?.trim()),
  claudeModel: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.5",
  prefer: options.provider ?? undefined,
});
const { provider, model } = decision;
const client = provider === "claude" ? new Anthropic({ apiKey: claudeKey }) : null;
console.log(`Provider: ${provider}; model: ${model}`);
const results = await mapConcurrent(cases, 3, runCase);
const rows = results.map((result) => ({
  id: result.id,
  stage: result.stage,
  expected: formatExpected(result.expected),
  got: formatExpected(result.got),
  result: result.pass ? "PASS" : "FAIL",
}));
console.table(rows);

const passed = results.filter((item) => item.pass).length;
const passRate = passed / results.length;
const costlyMistakes = results.filter((item) => item.expected.kind === "none" && (item.got.kind === "fix" || item.got.kind === "experiment"));
console.log(`Total: ${passed}/${results.length} passed (${(passRate * 100).toFixed(1)}%); costly none→change mistakes: ${costlyMistakes.length}`);

const report = {
  at: new Date().toISOString(),
  provider,
  model,
  filters: options,
  summary: { passed, total: results.length, passRate, costlyMistakes: costlyMistakes.map((item) => item.id) },
  results,
};
await fs.writeFile(path.join(root, "evals/last-run.json"), `${JSON.stringify(report, null, 2)}\n`);
if (passRate < 0.9 || costlyMistakes.length > 0) process.exitCode = 1;

async function runCase(testCase) {
  try {
    const system = testCase.stage === "triage" ? triageSystemPrompt() : designSystemPrompt();
    const user = testCase.stage === "triage" ? triageInput(testCase.input.signals) : designUserMessage(testCase.input.parts);
    const text = provider === "claude"
      ? await askClaude(system, user)
      : await askOpenAI(system, user);
    const parsed = readJson(text);
    const got = testCase.stage === "triage"
      ? { kinds: Object.fromEntries(parseTriageResults(parsed, new Set(testCase.input.signals.map((item) => item.id))).map((item) => [item.id, item.kind])) }
      : { kind: classifyDesignAnswer(parsed) };
    return { id: testCase.id, stage: testCase.stage, expected: testCase.expect, got, pass: same(testCase.expect, got), response: text };
  } catch (error) {
    return { id: testCase.id, stage: testCase.stage, expected: testCase.expect, got: { kind: "invalid" }, pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function askClaude(system, input) {
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: input }],
    output_config: { effort: "low" },
  });
  return response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}

async function askOpenAI(instructions, input) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, reasoning: { effort: "low" }, instructions, input }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI request failed.");
  const direct = payload.output_text?.trim();
  if (direct) return direct;
  const text = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("OpenAI returned an empty reply.");
  return text;
}

function readJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

function same(expected, got) {
  if (expected.kind) return expected.kind === got.kind;
  return Object.entries(expected.kinds).every(([id, kind]) => got.kinds[id] === kind)
    && Object.keys(got.kinds).length === Object.keys(expected.kinds).length;
}

function formatExpected(value) {
  if (value.kind) return value.kind;
  if (value.kinds) return Object.entries(value.kinds).map(([id, kind]) => `${id}:${kind}`).join(", ");
  return JSON.stringify(value);
}

function parseArgs(args) {
  const parsed = { only: null, stage: null, provider: null };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === "--only" && value) parsed.only = value;
    else if (flag === "--stage" && (value === "triage" || value === "design")) parsed.stage = value;
    else if (flag === "--provider" && (value === "claude" || value === "openai")) parsed.provider = value;
    else throw new Error(`Unknown or incomplete argument: ${flag}`);
    index++;
  }
  return parsed;
}

async function loadEnvLocal(file) {
  let source;
  try { source = await fs.readFile(file, "utf8"); } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value.replaceAll("\\n", "\n");
  }
}

async function mapConcurrent(items, concurrency, fn) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await fn(items[index]);
    }
  }));
  return output;
}
