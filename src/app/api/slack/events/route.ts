import { after } from "next/server";

import { runTick } from "@/lib/autopilot/loop";
import { addEvidence, knownEvidenceUrls, lastRunAt, log } from "@/lib/autopilot/store";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { tickTriggerDue } from "@/lib/autopilot/tick-trigger-core";
import { listUsersForSlackTeam } from "@/lib/connections/store";
import { slackChannelName } from "@/lib/slack/client";
import { messageEvidence, verifySlackSignature } from "@/lib/slack/events-core";

interface SlackEnvelope {
  type?: unknown;
  challenge?: unknown;
  team_id?: unknown;
  event?: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fileEventForUser(userId: string, event: SlackEnvelope["event"]): Promise<boolean> {
  return withAutopilotUser(userId, async () => {
    try {
      if (!event || typeof event !== "object") return false;
      const channel = "channel" in event && typeof event.channel === "string" ? event.channel : "";
      if (!channel) return false;

      const channelName = await slackChannelName(channel).catch(() => channel);
      const evidence = messageEvidence(event, channelName);
      if (!evidence) return false;
      const known = await knownEvidenceUrls([evidence.url]);
      if (known.has(evidence.url)) return false;

      await addEvidence([{ ...evidence, synthetic: false }]);
      await log("listen", `Filed a Slack message from #${channelName}.`);
      return tickTriggerDue(await lastRunAt(), new Date());
    } catch (error) {
      await log("error", `Could not file a Slack message: ${errorMessage(error)}`).catch(() => {});
      return false;
    }
  });
}

async function fileSlackEvent(teamId: string, event: SlackEnvelope["event"]): Promise<void> {
  try {
    const userIds = await listUsersForSlackTeam(teamId);
    for (const userId of userIds) {
      if (await fileEventForUser(userId, event)) await runTick(userId);
    }
  } catch {
    // Slack has already received its acknowledgement. Background failures must never escape after().
  }
}

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.text();
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!signingSecret) {
    return Response.json({ error: "Set SLACK_SIGNING_SECRET." }, { status: 503 });
  }

  const valid = verifySlackSignature({
    signingSecret,
    timestamp: request.headers.get("x-slack-request-timestamp") ?? "",
    signature: request.headers.get("x-slack-signature") ?? "",
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!valid) return Response.json({ error: "Invalid Slack signature." }, { status: 401 });

  let envelope: SlackEnvelope;
  try {
    envelope = JSON.parse(body) as SlackEnvelope;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (envelope.type === "url_verification") {
    return Response.json({ challenge: envelope.challenge });
  }

  if (envelope.type === "event_callback" && typeof envelope.team_id === "string") {
    after(() => fileSlackEvent(envelope.team_id as string, envelope.event));
  }
  return Response.json({ ok: true });
}
