import { getSlackStatus, SlackApiError } from "@/lib/slack/client";
import type { SlackStatus } from "@/lib/slack/types";

export async function GET() {
  try {
    return Response.json(await getSlackStatus());
  } catch (error) {
    const body: SlackStatus =
      error instanceof SlackApiError
        ? { connected: false, error: error.hint ?? error.code }
        : { connected: false, error: "Could not reach Slack." };
    return Response.json(body);
  }
}
