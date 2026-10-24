import { SlackApiError } from "@/lib/slack/client";
import { pollSlackMentions } from "@/lib/slack/mentions";

export const maxDuration = 120;

export async function POST() {
  try {
    const inbox = await pollSlackMentions();
    return Response.json({ inbox });
  } catch (error) {
    if (error instanceof SlackApiError) {
      return Response.json({ inbox: [], error: error.hint ?? error.code });
    }
    console.error("[slack-mentions]", error);
    return Response.json({ inbox: [], error: "Could not check Slack mentions." });
  }
}
