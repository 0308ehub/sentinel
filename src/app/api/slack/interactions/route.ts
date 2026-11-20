import { after } from "next/server";

import { approve, reject } from "@/lib/autopilot/lifecycle";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { getExperiment, listSignals, log } from "@/lib/autopilot/store";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { getConnection } from "@/lib/connections/store";
import { slackTeamAccount } from "@/lib/connections/ownership";
import { GitHubApiError } from "@/lib/github/client";
import { handledActionBlocks, parseActionPayload, startedActionBlocks, type SlackActionPayload } from "@/lib/slack/actions-core";
import { verifySlackSignature } from "@/lib/slack/events-core";
import { startSignalFromSlack } from "@/lib/slack/start-signal";
import { canApproveFromSlack, slackApprovalDenialMessage } from "@/lib/slack/approvers-core";
import { eligibleApprovers, slackUserEmail } from "@/lib/slack/approvers";

const ACTIONS = new Set(["kismet_approve", "kismet_decline", "kismet_try"]);
interface AccountMatch {
  userId: string;
  installerUserId?: string;
  botToken?: string;
  experiment?: Experiment;
  signal?: Signal;
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
  const account = await slackTeamAccount(payload.teamId);
  const userIds = account ? [account] : [];
  const matches: AccountMatch[] = [];
  for (const userId of userIds) {
    const [connection, experiment] = await Promise.all([
      getConnection(userId, "slack"),
      withAutopilotUser(userId, () => getExperiment(payload.experimentId)),
    ]);
    const installer = connection?.meta.installerUserId;
    const token = connection?.secret as { botToken?: unknown } | undefined;
    matches.push({
      userId,
      installerUserId: typeof installer === "string" && installer ? installer : undefined,
      botToken: typeof token?.botToken === "string" ? token.botToken.trim() : undefined,
      experiment: experiment ?? undefined,
    });
  }
  return matches;
}

async function signalAccountMatches(payload: SlackActionPayload): Promise<AccountMatch[]> {
  const account = await slackTeamAccount(payload.teamId);
  const userIds = account ? [account] : [];
  return Promise.all(userIds.map(async (userId) => {
    const signals = await withAutopilotUser(userId, () => listSignals());
    return { userId, signal: signals.find((signal) => signal.id === payload.experimentId) };
  }));
}

async function handleTry(payload: SlackActionPayload, originalText: string): Promise<void> {
  try {
    const accounts = await signalAccountMatches(payload);
    const owner = accounts.find((account) => account.signal);
    if (!owner?.signal) {
      await ephemeral(payload, "Kismet is already on this.");
      return;
    }
    const result = await withAutopilotUser(owner.userId, () =>
      startSignalFromSlack(owner.signal!.id, payload.slackUserId));
    if (result.status === "already") {
      await ephemeral(payload, "Kismet is already on this.");
      return;
    }
    await respond(payload.responseUrl, {
      replace_original: true,
      text: originalText,
      blocks: startedActionBlocks(originalText, payload.slackUserId),
    });
  } catch (error) {
    await ephemeral(payload, `Couldn't start: ${readableError(error)}`).catch(() => {});
  }
}

async function handleAction(payload: SlackActionPayload, originalText: string): Promise<void> {
  try {
    const accounts = await accountMatches(payload);
    const owner = accounts.find((account) => account.experiment);
    if (!owner?.experiment) {
      await ephemeral(payload, accounts.length
        ? "Kismet can't find this experiment anymore."
        : slackApprovalDenialMessage(null, undefined));
      return;
    }
    let slackEmail: string | null = null;
    let admins: Awaited<ReturnType<typeof eligibleApprovers>> = [];
    if (owner.installerUserId !== payload.slackUserId) {
      [slackEmail, admins] = await Promise.all([
        owner.botToken ? slackUserEmail(payload.slackUserId, owner.botToken) : Promise.resolve(null),
        eligibleApprovers(owner.userId),
      ]);
    }
    const authorized = canApproveFromSlack({
      slackUserId: payload.slackUserId,
      installerUserId: owner.installerUserId,
      slackEmail,
      accountId: owner.userId,
      admins,
    });
    if (!authorized) {
      await ephemeral(payload, slackApprovalDenialMessage(slackEmail, owner.installerUserId));
      return;
    }
    if (owner.experiment.status !== "awaiting_approval") {
      await ephemeral(payload, "This was already handled in Kismet.");
      return;
    }

    const action = payload.actionId === "kismet_approve" ? "approved" : "declined";
    await withAutopilotUser(owner.userId, async () => {
      if (action === "approved") await approve(owner.experiment!);
      else await reject(owner.experiment!);
      await log(
        "build",
        `${action === "approved" ? "Approved" : "Declined"} “${owner.experiment!.title}” from Slack.`,
        owner.experiment!.id,
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
  after(() => payload.actionId === "kismet_try"
    ? handleTry(payload, originalText)
    : handleAction(payload, originalText));
  return new Response(null, { status: 200 });
}
