import { listBotChannels, slackErrorResponse } from "@/lib/slack/client";

export async function GET() {
  try {
    return Response.json({ channels: await listBotChannels() });
  } catch (error) {
    return slackErrorResponse(error);
  }
}
