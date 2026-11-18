import assert from "node:assert/strict";
import test from "node:test";
import { experimentBranch, experimentTask } from "../src/lib/autopilot/agent-task.ts";
import {
  CLAUDE_WORKFLOW_YAML,
  WORKFLOW_START_GRACE_MS,
  cursorProgress,
  cursorRef,
  isOutsideBuilder,
  parseBuilder,
  parseCursorRef,
  pickWorkflowRun,
  workflowProgress,
} from "../src/lib/autopilot/builders.ts";

const experiment = {
  flag: "checkout-copy", title: "Clearer checkout", hypothesis: "More people finish", page: "/checkout",
  control: "Current button", treatment: "Clear button copy", metric: "Checkout completion", guardrail: "No errors",
};

const started = "2026-11-17T12:00:00.000Z";
const at = (minutes) => new Date(Date.parse(started) + minutes * 60_000).toISOString();
const run = (overrides) => ({ id: 1, status: "completed", conclusion: "success", url: "https://github.com/o/r/actions/runs/1", createdAt: at(0), ...overrides });

test("an unknown or missing builder falls back to Kismet's own agent", () => {
  assert.equal(parseBuilder("cursor"), "cursor");
  assert.equal(parseBuilder("claude-code"), "claude-code");
  assert.equal(parseBuilder("copilot"), "kismet");
  assert.equal(parseBuilder(undefined), "kismet");
  assert.equal(isOutsideBuilder("kismet"), false);
  assert.equal(isOutsideBuilder("cursor"), true);
});

test("an outside agent's task keeps it on the branch Kismet created and leaves the pull request to Kismet", () => {
  const task = experimentTask(experiment, undefined, true, true);
  assert.match(task, new RegExp(`You are on branch ${experimentBranch("checkout-copy")}`));
  assert.match(task, /Do not open a pull request/);
  assert.match(task, /kismet\.variant\("checkout-copy"\)/);
  assert.doesNotMatch(task, /\/workspace\/repo/);
  assert.doesNotMatch(task, /BRANCH:/);
});

test("Kismet's own agent still reports the branch it pushed", () => {
  const task = experimentTask(experiment, undefined, false);
  assert.match(task, /\/workspace\/repo/);
  assert.match(task, /End your final response with exactly: BRANCH: kismet\/exp-checkout-copy/);
});

test("a Cursor run is finished, failed or still running", () => {
  assert.deepEqual(cursorProgress("FINISHED"), { state: "finished" });
  for (const status of ["CREATING", "RUNNING", "WAITING_FOR_BACKGROUND_WORK", undefined, "SOMETHING_NEW"]) {
    assert.deepEqual(cursorProgress(status), { state: "running" });
  }
  for (const status of ["ERROR", "CANCELLED", "EXPIRED"]) {
    assert.equal(cursorProgress(status).state, "failed");
  }
});

test("a Cursor build reference round-trips and rejects other shapes", () => {
  assert.deepEqual(parseCursorRef(cursorRef("bc-1", "run-2")), { agentId: "bc-1", runId: "run-2" });
  assert.equal(parseCursorRef("kismet/exp-a/b"), null);
  assert.equal(parseCursorRef("bc-1"), null);
  assert.equal(parseCursorRef(""), null);
});

test("a workflow run from before this build started is not this build's run", () => {
  const old = run({ id: 1, conclusion: "failure", createdAt: at(-30) });
  const mine = run({ id: 2, status: "in_progress", conclusion: null, createdAt: at(0.1) });
  assert.equal(pickWorkflowRun([old], started), null);
  assert.equal(pickWorkflowRun([old, mine], started)?.id, 2);
  assert.equal(pickWorkflowRun([run({ id: 3, createdAt: at(1) }), mine], started)?.id, 3);
});

test("a dispatched workflow that is not listed yet is running, then failed once the grace period passes", () => {
  const begin = Date.parse(started);
  assert.deepEqual(workflowProgress(null, started, begin + 60_000), { state: "running" });
  assert.equal(workflowProgress(null, started, begin + WORKFLOW_START_GRACE_MS + 1).state, "failed");
});

test("a workflow run maps to running, finished or failed", () => {
  const now = Date.parse(started);
  assert.deepEqual(workflowProgress(run({ status: "queued", conclusion: null }), started, now), { state: "running" });
  assert.deepEqual(workflowProgress(run({ status: "in_progress", conclusion: null }), started, now), { state: "running" });
  assert.deepEqual(workflowProgress(run({}), started, now), { state: "finished" });
  for (const conclusion of ["failure", "cancelled", "timed_out", "skipped"]) {
    assert.equal(workflowProgress(run({ conclusion }), started, now).state, "failed");
  }
});

test("the Claude Code workflow starts by hand, runs Claude with the task, and pushes to the branch it ran on", () => {
  assert.match(CLAUDE_WORKFLOW_YAML, /workflow_dispatch:/);
  assert.match(CLAUDE_WORKFLOW_YAML, /prompt: \$\{\{ inputs\.task \}\}/);
  assert.match(CLAUDE_WORKFLOW_YAML, /secrets\.ANTHROPIC_API_KEY/);
  assert.match(CLAUDE_WORKFLOW_YAML, /git push origin "HEAD:\$\{GITHUB_REF_NAME\}"/);
  // The title reaches the shell through env, never by pasting an expression into the script.
  assert.doesNotMatch(CLAUDE_WORKFLOW_YAML.split("run: |")[1], /\$\{\{/);
  assert.doesNotMatch(CLAUDE_WORKFLOW_YAML, /\t/);
});
