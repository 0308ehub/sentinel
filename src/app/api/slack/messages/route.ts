import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { CHANNEL_ID_PATTERN, getChannelMessages, slackConnectionKey, SlackApiError, slackErrorResponse } from "@/lib/slack/client";

// Slack lets apps outside its Marketplace read a channel's history about once a minute, and Kismet's own
// background reads share that budget. Reuse a recent read, and fall back to it when Slack says to wait.
const FRESH_MS = 60_000;
const recent = new Map<string, { at: number; messages: Awaited<ReturnType<typeof getChannelMessages>> }>();

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel") ?? "";
  if (!CHANNEL_ID_PATTERN.test(channel)) {
    return Response.json({ error: "invalid_channel" }, { status: 400 });
  }

  const requested = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 50;

  try {
    const token = await slackConnectionKey();
    const key = `${createHash("sha256").update(token).digest("hex").slice(0, 16)}:${channel}:${limit}`;
    const cached = recent.get(key);
    if (cached && Date.now() - cached.at < FRESH_MS) return Response.json({ messages: cached.messages });
    try {
      const messages = await getChannelMessages(channel, limit);
      if (recent.size > 500) recent.clear();
      recent.set(key, { at: Date.now(), messages });
      return Response.json({ messages });
    } catch (error) {
      if (error instanceof SlackApiError && error.code === "ratelimited") {
        if (cached) return Response.json({ messages: cached.messages, stale: true });
        return Response.json({ messages: [], waiting: true });
      }
      throw error;
    }
  } catch (error) {
    return slackErrorResponse(error);
  }
}
