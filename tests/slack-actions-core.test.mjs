import assert from "node:assert/strict";
import test from "node:test";

import { handledActionBlocks, parseActionPayload, reviewActionBlocks, tryActionBlocks } from "../src/lib/slack/actions-core.ts";

test("reviewActionBlocks builds approve and decline buttons", () => {
  const blocks = reviewActionBlocks("Review this", "exp-123");
  assert.equal(blocks[0].type, "section");
  assert.equal(blocks[0].text.text, "Review this");
  const [approve, decline] = blocks[1].elements;
  assert.deepEqual(
    { id: approve.action_id, value: approve.value, style: approve.style },
    { id: "kismet_approve", value: "exp-123", style: "primary" },
  );
  assert.equal(approve.confirm.title.text, "Approve & merge?");
  assert.equal(approve.confirm.text.text, "This merges the pull request and ships the change.");
  assert.equal(approve.confirm.confirm.text, "Approve & merge");
  assert.equal(approve.confirm.deny.text, "Cancel");
  assert.deepEqual(
    { id: decline.action_id, value: decline.value },
    { id: "kismet_decline", value: "exp-123" },
  );
});

test("tryActionBlocks builds the idea start button", () => {
  const blocks = tryActionBlocks("Try this idea", "sig-123");
  assert.equal(blocks[0].text.text, "Try this idea");
  assert.deepEqual(blocks[1].elements[0], {
    type: "button",
    text: { type: "plain_text", text: "Try it now" },
    style: "primary",
    action_id: "kismet_try",
    value: "sig-123",
  });
});

function form(overrides = {}) {
  const payload = {
    type: "block_actions",
    team: { id: "T1" },
    user: { id: "U1" },
    actions: [{ action_id: "kismet_approve", value: "exp-1" }],
    response_url: "https://hooks.slack.com/actions/1/2/3",
    channel: { id: "C1" },
    message: { ts: "123.456" },
    ...overrides,
  };
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
}

test("parseActionPayload reads a valid block action", () => {
  assert.deepEqual(parseActionPayload(form()), {
    teamId: "T1",
    slackUserId: "U1",
    actionId: "kismet_approve",
    experimentId: "exp-1",
    responseUrl: "https://hooks.slack.com/actions/1/2/3",
    channelId: "C1",
    messageTs: "123.456",
  });
});

test("parseActionPayload rejects the wrong type and missing fields", () => {
  assert.equal(parseActionPayload(form({ type: "view_submission" })), null);
  assert.equal(parseActionPayload(form({ team: {} })), null);
  assert.equal(parseActionPayload("payload=not-json"), null);
});

test("handledActionBlocks removes buttons and identifies the actor", () => {
  assert.deepEqual(handledActionBlocks("Original review", "U55", "approved"), [
    { type: "section", text: { type: "mrkdwn", text: "Original review" } },
    { type: "context", elements: [{ type: "mrkdwn", text: "Approved by <@U55> · merging…" }] },
  ]);
  const declined = handledActionBlocks("Original review", "U55", "declined");
  assert.equal(declined[1].elements[0].text, "Declined by <@U55>");
});
