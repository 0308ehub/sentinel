import "server-only";

import { claim, claimShared, release, releaseShared } from "@/lib/autopilot/notify";
import { threadUpdates } from "@/lib/autopilot/thread-updates-core";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { listExperiments, listSignals, log } from "@/lib/autopilot/store";
import { siteUrl } from "@/lib/site";
import { reviewActionBlocks, tryActionBlocks } from "@/lib/slack/actions-core";
import { postSlackBlocks, postSlackMessage, SlackApiError } from "@/lib/slack/client";
import { slackActiveForAccount } from "@/lib/connections/ownership";

// Retrying these never helps: the thread or channel is gone, or the bot is no longer in it.
const FINAL_SLACK_ERRORS = new Set(["not_in_channel", "channel_not_found", "thread_not_found", "message_not_found", "is_archived", "cant_reply"]);

const DAY = 86_400_000;

function recentReporterThread(signal: Signal, channelId: string, threadTs: string, now: number): boolean {
  const url = `slack://${channelId}/${threadTs}`;
  return signal.evidence.some((item) =>
    item.source === "slack" && item.url === url && /^[UW][A-Z0-9]+$/.test(item.author ?? "") &&
    Date.parse(item.occurredAt) >= now - DAY && Date.parse(item.occurredAt) <= now,
  );
}

function recentMergedFix(experiment: Experiment | undefined, now: number): boolean {
  return Boolean(
    experiment?.kind === "fix" && experiment.startedAt &&
    Date.parse(experiment.startedAt) >= now - 7 * DAY && Date.parse(experiment.startedAt) <= now,
  );
}

/** Posts newly reached state-derived updates to the Slack threads that reported each signal. */
export async function postThreadUpdates(): Promise<number> {
  if (!(await slackActiveForAccount())) return 0;
  const [signals, experiments] = await Promise.all([listSignals(), listExperiments()]);
  const updates = threadUpdates({ signals, experiments, appUrl: siteUrl(), now: new Date() });
  const firstCall = await claim("thread_updates_baseline");
  let pending = updates;

  if (firstCall) {
    const now = Date.now();
    const signalsById = new Map(signals.map((signal) => [signal.id, signal]));
    const experimentsById = new Map(experiments.map((experiment) => [experiment.id, experiment]));
    pending = [];
    for (const update of updates) {
      const parts = update.key.split(":");
      const subjectId = parts[1];
      const experiment = update.stage === "received" ? undefined : experimentsById.get(subjectId);
      const signal = update.stage === "received" ? signalsById.get(subjectId) : signalsById.get(experiment?.signalId ?? "");
      const shouldPost = Boolean(
        signal && recentReporterThread(signal, update.channelId, update.threadTs, now) ||
        update.stage === "merged" && recentMergedFix(experiment, now),
      );
      if (shouldPost) pending.push(update);
      else await claim(update.key);
    }
  }

  let posted = 0;
  for (const update of pending) {
    if (posted === 20) break;
    if (!(await claim(update.key))) continue;
    // Per thread and stage across accounts, so two accounts on one Slack workspace never both reply.
    const threadKey = `slack_thread:${update.channelId}:${update.threadTs}:${update.stage}`;
    if (!(await claimShared(threadKey))) continue;
    try {
      if (update.actionsFor) {
        await postSlackBlocks(update.channelId, update.text, reviewActionBlocks(update.text, update.actionsFor), update.threadTs);
      } else if (update.tryFor) {
        await postSlackBlocks(update.channelId, update.text, tryActionBlocks(update.text, update.tryFor), update.threadTs);
      } else {
        await postSlackMessage(update.channelId, update.text, update.threadTs);
      }
      posted += 1;
    } catch (error) {
      if (error instanceof SlackApiError && FINAL_SLACK_ERRORS.has(error.code)) {
        console.info(`[autopilot] skipped a Slack thread update: ${error.code}`);
        continue;
      }
      await release(update.key);
      await releaseShared(threadKey);
      console.error("[autopilot] could not post Slack thread update", error);
      const detail = error instanceof Error ? error.message : String(error);
      await log("error", `Could not post a Slack reporter update: ${detail}`).catch(() => {});
    }
  }
  return posted;
}
