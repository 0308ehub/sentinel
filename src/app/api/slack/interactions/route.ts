import { after } from "next/server";

import { approve, reject } from "@/lib/autopilot/lifecycle";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { getExperiment, log } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";
import { getConnection, listUsersForSlackTeam } from "@/lib/connections/store";
import { GitHubApiError } from "@/lib/github/client";
import { handledActionBlocks, parseActionPayload, type SlackActionPayload } from "@/lib/slack/actions-core";
import { verifySlackSignature } from "@/lib/slack/events-core";

const ACTIONS = new Set(["kismet_approve", "kismet_decline"]);
const RECONNECT_MESSAGE = "To approve from Slack, reconnect Slack in Kismet (Settings → Connectors → Slack) once.";

interface AccountMatch {
  userId: string;
  installerUserId?: string;
  experiment?: Experiment;
}

function originalMessageText(body: string): string {
  try {
    const payload = new URLSearchParams(body).get("payload");
    if (!payload) return "Kismet review";
    const parsed = JSON.parse(payload) as {
      message?: { text?: unknown; blocks?: Array<{ type?: unknown; text?: { text?: unknown } }> };
    };
    const sectionText = parsed.message?.blocks?.find((block) => block.type === "section")?.text?.text;
    if (typeof sectionText === "string" && sectionText) return sectionText;
    return typeof parsed.message?.text === "string" && parsed.message.text ? parsed.message.text : "Kismet review";
  } catch {
    return "Kismet review";
  }
}

async function respond(responseUrl: string, body: Record<string, unknown>): Promise<void> {
  if (!responseUrl.startsWith("https://hooks.slack.com/")) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

function ephemeral(payload: SlackActionPayload, text: string): Promise<void> {
  return respond(payload.responseUrl, { response_type: "ephemeral", replace_original: false, text });
}

function readableError(error: unknown): string {
  if (error instanceof GitHubApiError) return error.hint ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function accountMatches(payload: SlackActionPayload): Promise<AccountMatch[]> {
  const userIds = await listUsersForSlackTeam(payload.teamId);
  const matches: AccountMatch[] = [];
  for (const userId of userIds) {
    const [connection, experiment] = await Promise.all([
      getConnection(userId, "slack"),
      withAutopilotUser(userId, () => getExperiment(payload.experimentId)),
    ]);
    const installer = connection?.meta.installerUserId;
    matches.push({
      userId,
      installerUserId: typeof installer === "string" && installer ? installer : undefined,
      experiment: experiment ?? undefined,
    });
  }
  return matches;
}

async function handleAction(payload: SlackActionPayload, originalText: string): Promise<void> {
  try {
    const accounts = await accountMatches(payload);
    const owner = accounts.find((account) => account.experiment);
    const authorized = accounts.find(
      (account) => account.experiment && account.installerUserId === payload.slackUserId,
    );
    if (!authorized?.experiment) {
      const text = owner?.installerUserId
        ? `Only <@${owner.installerUserId}> can approve from Slack.`
        : RECONNECT_MESSAGE;
      await ephemeral(payload, text);
      return;
    }
    if (authorized.experiment.status !== "awaiting_approval") {
      await ephemeral(payload, "This was already handled in Kismet.");
      return;
    }

    const action = payload.actionId === "kismet_approve" ? "approved" : "declined";
    await withAutopilotUser(authorized.userId, async () => {
      if (action === "approved") await approve(authorized.experiment!);
      else await reject(authorized.experiment!);
      await log(
        "build",
        `${action === "approved" ? "Approved" : "Declined"} “${authorized.experiment!.title}” from Slack.`,
        authorized.experiment!.id,
      );
    });
    await respond(payload.responseUrl, {
      replace_original: true,
      text: originalText,
      blocks: handledActionBlocks(originalText, payload.slackUserId, action),
    });
  } catch (error) {
    const verb = payload.actionId === "kismet_approve" ? "approve" : "decline";
    await ephemeral(payload, `Couldn't ${verb}: ${readableError(error)}`).catch(() => {});
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

  const payload = parseActionPayload(body);
  if (!payload || !ACTIONS.has(payload.actionId)) return new Response(null, { status: 200 });
  const originalText = originalMessageText(body);
  after(() => handleAction(payload, originalText));
  return new Response(null, { status: 200 });
}
