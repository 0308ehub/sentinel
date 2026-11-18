import "server-only";

import { addEvidence, knownEvidenceUrls, log, type NewEvidence } from "@/lib/autopilot/store";
import { evidenceFromGraph, type FiledEvidence } from "@/lib/autopilot/workspace-evidence";
import { actingUserId } from "@/lib/connections/current";
import { listRecentIssues } from "@/lib/jira/client";
import { listBotChannels, listRecentMessages, SlackApiError } from "@/lib/slack/client";
import { slackMessageEvidence } from "@/lib/slack/events-core";
import { loadStates } from "@/lib/workspace/state-store";

/** Most new items filed per tick, newest first; the rest arrive on later ticks. */
const MAX_NEW_EVIDENCE = 20;

async function graphEvidence(userId: string): Promise<FiledEvidence[]> {
  try {
    const states = await loadStates(userId);
    return evidenceFromGraph(states.graph?.data);
  } catch (error) {
    console.error("[autopilot] workspace evidence", error);
    return [];
  }
}

async function jiraEvidence(): Promise<FiledEvidence[]> {
  try {
    const issues = await listRecentIssues(10);
    return issues.filter((issue) => issue.url).map((issue) => ({
      source: "ticket" as const,
      title: `${issue.key}: ${issue.summary}`.slice(0, 180),
      body: `${issue.type} in ${issue.project}, status ${issue.status}. ${issue.description}`.trim().slice(0, 1500),
      author: issue.assignee || "Jira",
      url: issue.url,
      occurredAt: issue.updated || new Date().toISOString(),
    }));
  } catch (error) {
    // An account without Jira connected is normal, not an error worth logging every hour.
    if (!(error instanceof Error && error.message === "missing_config")) console.error("[autopilot] jira evidence", error);
    return [];
  }
}

function slackReadFailure(error: unknown): string | null {
  if (error instanceof SlackApiError) {
    // Not connected is normal; a rate limit just means this channel waits for the next tick.
    if (error.code === "not_connected" || error.code === "ratelimited") return null;
    return error.hint || error.code;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Slack lets apps outside its Marketplace read channel history about once a minute, 15 messages at a
 * time. So each tick reads one channel, taking the bot's channels in turn hour by hour.
 */
async function slackEvidence(): Promise<FiledEvidence[]> {
  try {
    const channels = [...(await listBotChannels())].sort((a, b) => a.id.localeCompare(b.id));
    if (!channels.length) return [];
    const channel = channels[Math.floor(Date.now() / 3_600_000) % channels.length];
    const messages = await listRecentMessages(channel.id);
    return messages
      .map((message) => slackMessageEvidence({
        channelId: channel.id,
        ts: message.ts,
        text: message.text,
        userId: message.userId,
      }, channel.name))
      .filter((item): item is FiledEvidence => item !== null);
  } catch (error) {
    const reason = slackReadFailure(error);
    if (reason) await log("error", `Could not read Slack: ${reason}`).catch(() => {});
    return [];
  }
}

function asNew(item: FiledEvidence): NewEvidence {
  const parsed = Date.parse(item.occurredAt);
  return {
    ...item,
    synthetic: false,
    occurredAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString(),
  };
}

/** Evidence this account filed in Kismet, plus its connected Jira and Slack. Safe to repeat. */
export async function workspaceEvidence(): Promise<string | null> {
  const userId = await actingUserId();
  if (!userId) return null;
  const candidates = [...(await graphEvidence(userId)), ...(await jiraEvidence()), ...(await slackEvidence())];
  const known = await knownEvidenceUrls(candidates.map((item) => item.url));
  // Drop what's already filed before capping, so old messages in one channel can't crowd out new ones.
  const fresh = candidates
    .filter((item) => item.url && !known.has(item.url))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, MAX_NEW_EVIDENCE);
  const added = await addEvidence(fresh.map(asNew));
  return added ? `Collected ${added} from the workspace, Slack, and Jira.` : null;
}
