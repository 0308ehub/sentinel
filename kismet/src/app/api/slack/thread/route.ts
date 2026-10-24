import type { NextRequest } from "next/server";
import {
  CHANNEL_ID_PATTERN,
  getThreadReplies,
  SLACK_TS_PATTERN,
  slackErrorResponse,
} from "@/lib/slack/client";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel") ?? "";
  const ts = request.nextUrl.searchParams.get("ts") ?? "";
  if (!CHANNEL_ID_PATTERN.test(channel) || !SLACK_TS_PATTERN.test(ts)) {
    return Response.json({ error: "invalid_params" }, { status: 400 });
  }

  try {
    return Response.json({ messages: await getThreadReplies(channel, ts) });
  } catch (error) {
    return slackErrorResponse(error);
  }
}
