import "server-only";

import { addEvidence, knownEvidenceUrls, log, type NewEvidence } from "@/lib/autopilot/store";
import { evidenceFromGraph, type FiledEvidence } from "@/lib/autopilot/workspace-evidence";
import { actingUserId } from "@/lib/connections/current";
import { listRecentIssues } from "@/lib/jira/client";
import { listBotChannels, listRecentMessages, SlackApiError } from "@/lib/slack/client";
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

function slackTime(ts: string): string {
  const seconds = Number(ts.split(".")[0]);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

async function slackEvidence(): Promise<FiledEvidence[]> {
  try {
    const channels = (await listBotChannels()).slice(0, 3);
    const found: FiledEvidence[] = [];
    for (const channel of channels) {
      const messages = await listRecentMessages(channel.id);
      for (const message of messages) {
        const text = message.text.replace(/\s+/g, " ").trim();
        if (text.length < 12 || !message.ts) continue;
        found.push({
          source: "slack",
          title: text.slice(0, 180),
          body: `#${channel.name}: ${text}`.slice(0, 500),
          author: message.userId || "Slack",
          url: `slack://${channel.id}/${message.ts}`,
          occurredAt: slackTime(message.ts),
        });
      }
    }
    return found;
  } catch (error) {
    // An account without Slack connected is normal; anything else should show in the activity log.
    if (!(error instanceof SlackApiError && error.code === "not_connected")) {
      const reason = error instanceof SlackApiError ? error.hint || error.code : error instanceof Error ? error.message : String(error);
      await log("error", `Could not read Slack: ${reason}`).catch(() => {});
    }
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
