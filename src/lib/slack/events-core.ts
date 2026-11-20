import { createHmac, timingSafeEqual } from "node:crypto";

import type { FiledEvidence } from "../autopilot/workspace-evidence.ts";

interface SlackMessageInput {
  channelId: string;
  ts: string;
  text: string;
  userId?: string;
}

interface SlackMessageEvent {
  type?: unknown;
  channel_type?: unknown;
  channel?: unknown;
  ts?: unknown;
  text?: unknown;
  user?: unknown;
  bot_id?: unknown;
  subtype?: unknown;
  thread_ts?: unknown;
}

function slackTime(ts: string): string {
  const seconds = Number(ts.split(".")[0]);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

export function slackMessageEvidence(input: SlackMessageInput, channelName: string): FiledEvidence | null {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (text.length < 12 || !input.channelId || !input.ts) return null;

  return {
    source: "slack",
    title: text.slice(0, 180),
    body: `#${channelName}: ${text}`.slice(0, 500),
    author: input.userId || "Slack",
    url: `slack://${input.channelId}/${input.ts}`,
    occurredAt: slackTime(input.ts),
  };
}

/** True for a message a person wrote: not a bot (including Kismet's own posts) and not a join or edit notice. */
export function isPersonMessage(message: { botId?: unknown; subtype?: unknown; userId?: unknown }): boolean {
  if (message.botId != null) return false;
  if (message.subtype != null && message.subtype !== "thread_broadcast" && message.subtype !== "file_share") return false;
  return typeof message.userId === "string" && message.userId.length > 0;
}

/** A short reply that unambiguously asks Kismet to start. */
export function isTryYes(text: unknown): boolean {
  if (typeof text !== "string" || text.length > 40) return false;
  const normalized = text
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+$/gu, "")
    .trim();
  return /^(?:yes|yep|yeah|sure|do it|try it|go ahead|please do)$/.test(normalized);
}

export interface SlackTryReply {
  channel: string;
  threadTs: string;
  slackUserId: string;
}

export function tryReply(event: unknown): SlackTryReply | null {
  if (!event || typeof event !== "object") return null;
  const message = event as SlackMessageEvent;
  if (message.type !== "message" || typeof message.channel !== "string" || typeof message.ts !== "string" ||
    typeof message.thread_ts !== "string" || message.thread_ts === message.ts || !isTryYes(message.text) ||
    !isPersonMessage({ botId: message.bot_id, subtype: message.subtype, userId: message.user })) return null;
  return { channel: message.channel, threadTs: message.thread_ts, slackUserId: message.user as string };
}

export function messageEvidence(event: SlackMessageEvent, channelName: string): FiledEvidence | null {
  if (event.type !== "message") return null;
  if (event.channel_type !== "channel" && event.channel_type !== "group") return null;
  if (!isPersonMessage({ botId: event.bot_id, subtype: event.subtype, userId: event.user })) return null;
  if (typeof event.channel !== "string" || typeof event.ts !== "string" || typeof event.text !== "string") return null;

  return slackMessageEvidence(
    {
      channelId: event.channel,
      ts: event.ts,
      text: event.text,
      userId: typeof event.user === "string" ? event.user : undefined,
    },
    channelName,
  );
}

export function verifySlackSignature({
  signingSecret,
  timestamp,
  body,
  signature,
  nowSeconds,
}: {
  signingSecret: string;
  timestamp: string;
  body: string;
  signature: string;
  nowSeconds: number;
}): boolean {
  if (!signingSecret || !timestamp || !body || !signature) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) return false;

  const expected = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
