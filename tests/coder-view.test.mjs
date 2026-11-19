import assert from "node:assert/strict";
import test from "node:test";
import { toCoderView } from "../src/lib/coder/view.ts";

const session = { status: "idle", usage: { list_cost: { amount: "12", currency: "USD" } } };
const text = (value) => [{ type: "text", text: value }];

test("projects messages, tool steps, errors, and status", () => {
  const view = toCoderView([
    { type: "session.status_running", id: "s1" },
    { type: "session.thread_status_running", id: "t1" },
    { type: "user.message", id: "u1", content: text("Fix the tests") },
    { type: "span.model_request_start", id: "span1" },
    { type: "agent.thinking", id: "think1" },
    { type: "agent.tool_use", id: "tool1", name: "bash", input: { command: "npm test\necho done" }, evaluated_permission: "allow" },
    { type: "agent.tool_result", id: "result1", tool_use_id: "tool1", content: text("failed"), is_error: true },
    { type: "session.error", id: "error1", error: { type: "unknown_error", message: "Sandbox stopped." } },
    { type: "session.status_idle", id: "s2", stop_reason: { type: "end_turn" } },
  ], session);
  assert.deepEqual(view.items, [
    { kind: "user", text: "Fix the tests" },
    { kind: "step", tool: "bash", summary: "Ran `npm test`", isError: true, command: "npm test\necho done" },
    { kind: "error", text: "Sandbox stopped." },
  ]);
  assert.equal(view.stopReason, "end_turn");
  assert.equal(view.costCents, "12");
});

test("finds the latest unanswered approval", () => {
  const view = toCoderView([
    { type: "agent.tool_use", id: "one", name: "read", input: { file_path: "src/one.ts" }, evaluated_permission: "ask" },
    { type: "user.tool_confirmation", id: "confirm", tool_use_id: "one", result: "allow" },
    { type: "agent.tool_use", id: "two", name: "edit", input: { file_path: "src/two.ts" }, evaluated_permission: "ask" },
  ], session);
  assert.deepEqual(view.pendingApproval, { toolUseId: "two", tool: "edit", summary: "Edited src/two.ts" });
});

test("clears an answered approval", () => {
  const events = [
    { type: "agent.tool_use", id: "tool1", name: "grep", input: { pattern: "TODO" }, evaluated_permission: "ask" },
    { type: "user.tool_confirmation", id: "confirm1", tool_use_id: "tool1", result: "deny" },
  ];
  assert.equal(toCoderView(events, session).pendingApproval, null);
});

test("extracts the last branch and removes branch lines from agent text", () => {
  const view = toCoderView([
    { type: "agent.message", id: "a1", content: text("First change.\nBRANCH: kismet/first") },
    { type: "agent.message", id: "a2", content: text("All done.\nBRANCH: kismet/fix/widget-2") },
  ], session);
  assert.equal(view.branch, "kismet/fix/widget-2");
  assert.deepEqual(view.items, [
    { kind: "agent", text: "First change." },
    { kind: "agent", text: "All done." },
  ]);
});
