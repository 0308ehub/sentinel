import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { isPersonMessage, isTryYes, messageEvidence, tryReply, verifySlackSignature } from "../src/lib/slack/events-core.ts";

const secret = "signing-secret";
const timestamp = "1800000000";
const body = JSON.stringify({ type: "event_callback", team_id: "T123" });
const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;

function verify(overrides = {}) {
  return verifySlackSignature({
    signingSecret: secret,
    timestamp,
    body,
    signature,
    nowSeconds: Number(timestamp),
    ...overrides,
  });
}

test("verifies a valid Slack signature", () => {
  assert.equal(verify(), true);
});

test("rejects tampering, the wrong secret, stale requests, and missing headers", () => {
  assert.equal(verify({ body: `${body} ` }), false);
  assert.equal(verify({ signingSecret: "wrong" }), false);
  assert.equal(verify({ nowSeconds: Number(timestamp) + 301 }), false);
  assert.equal(verify({ signature: "" }), false);
  assert.equal(verify({ timestamp: "" }), false);
});

function event(overrides = {}) {
  return {
    type: "message",
    channel_type: "channel",
    channel: "C123",
    ts: "1700000000.123400",
    text: "  Customers   cannot complete checkout today.  ",
    user: "U123",
    ...overrides,
  };
}

test("builds channel and private-group evidence in the polling format", () => {
  const evidence = messageEvidence(event(), "customer-help");
  assert.deepEqual(evidence, {
    source: "slack",
    title: "Customers cannot complete checkout today.",
    body: "#customer-help: Customers cannot complete checkout today.",
    author: "U123",
    url: "slack://C123/1700000000.123400",
    occurredAt: "2023-11-14T22:13:20.000Z",
  });
  assert.ok(messageEvidence(event({ channel_type: "group" }), "private-help"));
});

test("accepts file shares and thread broadcasts", () => {
  assert.ok(messageEvidence(event({ subtype: "file_share" }), "help"));
  assert.ok(messageEvidence(event({ subtype: "thread_broadcast" }), "help"));
});

test("rejects bots, unsupported subtypes, short text, and direct messages", () => {
  assert.equal(messageEvidence(event({ bot_id: "B123" }), "help"), null);
  assert.equal(messageEvidence(event({ subtype: "channel_join" }), "help"), null);
  assert.equal(messageEvidence(event({ subtype: "message_changed" }), "help"), null);
  assert.equal(messageEvidence(event({ text: "too short" }), "help"), null);
  assert.equal(messageEvidence(event({ channel_type: "im" }), "help"), null);
});

test("caps Slack evidence title and body lengths", () => {
  const evidence = messageEvidence(event({ text: "word ".repeat(200) }), "long-channel-name");
  assert.equal(evidence.title.length, 180);
  assert.equal(evidence.body.length, 500);
});

test("history polling keeps only messages people wrote", () => {
  assert.equal(isPersonMessage({ userId: "U1" }), true);
  assert.equal(isPersonMessage({ userId: "U1", subtype: "thread_broadcast" }), true);
  assert.equal(isPersonMessage({ botId: "B1", userId: "U1" }), false);
  assert.equal(isPersonMessage({ subtype: "bot_message" }), false);
  assert.equal(isPersonMessage({ userId: "U1", subtype: "channel_join" }), false);
  assert.equal(isPersonMessage({}), false);
});

test("recognizes only short, unambiguous try replies", () => {
  for (const text of ["yes", "Yep!", "yeah 👍", "sure", "do it.", "try it 🚀", "go ahead!!", "please do 🙏"]) {
    assert.equal(isTryYes(text), true, text);
  }
  for (const text of ["no", "yes but wait", "yes, but…", "sure if the team agrees", "please do this after we update the spec", "y".repeat(41), ""]) {
    assert.equal(isTryYes(text), false, text);
  }
});

test("extracts affirmative replies only from person-authored thread messages", () => {
  const reply = event({ ts: "1700000001.000", thread_ts: "1700000000.123400", text: "yes!" });
  assert.deepEqual(tryReply(reply), {
    channel: "C123",
    threadTs: "1700000000.123400",
    slackUserId: "U123",
  });
  assert.equal(tryReply(event({ text: "yes!" })), null);
  assert.equal(tryReply(event({ thread_ts: "1700000000.123400", text: "yes!" })), null);
  assert.equal(tryReply(event({ ts: "1700000001.000", thread_ts: "1700000000.123400", text: "yes!", bot_id: "B1" })), null);
});
