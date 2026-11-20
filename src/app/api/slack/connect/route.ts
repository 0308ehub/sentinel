import { currentUserId } from "@/lib/connections/current";
import { connectErrorMessage } from "@/lib/connections/errors";
import { saveConnection } from "@/lib/connections/store";
import { canConnectSlackTeam, SLACK_TEAM_TAKEN_MESSAGE } from "@/lib/connections/ownership";
import { validateSlackToken } from "@/lib/slack/client";

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = (await request.json()) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token.startsWith("xoxb-")) throw new Error("Enter a Slack bot token beginning with xoxb-.");

    const meta = await validateSlackToken(token);
    if (!meta.teamId) throw new Error("Slack did not identify that workspace.");
    if (!(await canConnectSlackTeam(userId, meta.teamId))) throw new Error(SLACK_TEAM_TAKEN_MESSAGE);
    await saveConnection(userId, "slack", { botToken: token }, meta);
    return Response.json({ connected: true, team: meta.teamName });
  } catch (error) {
    return Response.json({ error: connectErrorMessage(error, "Could not connect Slack.") }, { status: 400 });
  }
}
