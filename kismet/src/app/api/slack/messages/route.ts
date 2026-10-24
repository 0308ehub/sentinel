import type { NextRequest } from "next/server";
import { CHANNEL_ID_PATTERN, getChannelMessages, slackErrorResponse } from "@/lib/slack/client";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel") ?? "";
  if (!CHANNEL_ID_PATTERN.test(channel)) {
    return Response.json({ error: "invalid_channel" }, { status: 400 });
  }

  const requested = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 50;

  try {
    return Response.json({ messages: await getChannelMessages(channel, limit) });
  } catch (error) {
    return slackErrorResponse(error);
  }
}
