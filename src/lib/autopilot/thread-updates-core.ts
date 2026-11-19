import { reporterThreads } from "./notify-core.ts";
import type { Experiment, Signal } from "./types.ts";

export type ThreadUpdateStage =
  | "received"
  | "working"
  | "review"
  | "merged"
  | "no_change"
  | "declined"
  | "failed"
  | "fixed"
  | "not_fixed"
  | "result";

export interface ThreadUpdate {
  key: string;
  channelId: string;
  threadTs: string;
  text: string;
  stage: ThreadUpdateStage;
  actionsFor?: string;
}

interface ThreadUpdatesInput {
  signals: Signal[];
  experiments: Experiment[];
  appUrl: string;
  now: Date;
}

// Progress updates post only while they are still true; a step missed between runs (say, merged within two
// minutes of the PR opening) is skipped rather than announced after the fact.
const STILL_WORKING = new Set<Experiment["status"]>(["building", "awaiting_approval"]);
const STILL_IN_REVIEW = new Set<Experiment["status"]>(["awaiting_approval"]);

function latestExperiment(experiments: Experiment[]): Experiment | undefined {
  return [...experiments].sort((a, b) => b.version - a.version || Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function link(appUrl: string, experimentId: string): string {
  return `${appUrl.replace(/\/$/, "")}/experiments?experiment=${encodeURIComponent(experimentId)}`;
}

function finishSentence(value: string): string {
  return `${value.trim().replace(/[.!?]+$/, "")}.`;
}

function experimentUpdates(experiment: Experiment, appUrl: string): Array<{ stage: ThreadUpdateStage; text: string }> {
  const updates: Array<{ stage: ThreadUpdateStage; text: string }> = [];
  const experimentLink = link(appUrl, experiment.id);
  const hasBuild = Boolean(experiment.buildStartedAt || experiment.coderSessionId || experiment.prNumber);
  if (experiment.status === "building" || (STILL_WORKING.has(experiment.status) && hasBuild)) {
    updates.push({
      stage: "working",
      text: experiment.kind === "fix"
        ? `Kismet is writing a fix: ${experiment.title}. Follow along: ${experimentLink}`
        : `Kismet is building an experiment for this: ${experiment.title}. Follow along: ${experimentLink}`,
    });
  }
  if (experiment.prUrl && STILL_IN_REVIEW.has(experiment.status)) {
    updates.push({
      stage: "review",
      text: experiment.kind === "fix"
        ? `The fix is ready for review: ${experiment.prUrl}. It ships once someone approves it in Kismet: ${experimentLink}`
        : `The experiment is ready for review: ${experiment.prUrl}. It ships once someone approves it in Kismet: ${experimentLink}`,
    });
  }
  if (experiment.kind === "fix" && experiment.status === "rolled_out") {
    updates.push({
      stage: "merged",
      text: `Merged and live: ${experiment.title} (${experiment.prUrl}). Kismet will watch for new reports over the next 14 days.`,
    });
  } else if (experiment.kind !== "fix" && ["running", "rolling_out"].includes(experiment.status)) {
    updates.push({
      stage: "merged",
      text: "The change is live for part of your visitors as an experiment. Kismet will post the result here.",
    });
  }

  if (experiment.status === "rejected" && experiment.rejectedBy === "kismet" && experiment.note?.startsWith("No change needed")) {
    const reason = experiment.note.replace(/^No change needed:?\s*/, "") || "the reported behavior is expected";
    updates.push({ stage: "no_change", text: `Kismet looked into this and no change is needed: ${finishSentence(reason)}` });
  } else if (experiment.status === "rejected" && experiment.rejectedBy === "person") {
    updates.push({ stage: "declined", text: "This was declined in Kismet, so nothing will ship for now." });
  } else if (experiment.status === "failed") {
    const note = (experiment.note || "Kismet could not complete the work").slice(0, 200);
    updates.push({ stage: "failed", text: `Kismet couldn't finish this automatically: ${finishSentence(note)} It's back on the list for a person to look at.` });
  } else if (experiment.kind === "fix" && experiment.verdict === "fixed") {
    updates.push({ stage: "fixed", text: "Update: no new reports in the 14 days since the fix, so Kismet marked this fixed." });
  } else if (experiment.kind === "fix" && experiment.verdict === "not_fixed") {
    updates.push({ stage: "not_fixed", text: "Update: reports continued after the fix, so Kismet reopened this." });
  } else if (
    experiment.kind !== "fix" && experiment.readout && ["won", "lost", "flat"].includes(experiment.readout.verdict) &&
    ["awaiting_rollout", "rolled_out", "stopped"].includes(experiment.status)
  ) {
    const result = experiment.readout.verdict === "won"
      ? "the new version won"
      : experiment.readout.verdict === "lost"
        ? "the new version did worse, so it was turned off"
        : "no clear difference";
    updates.push({ stage: "result", text: `Result: ${result}.` });
  }
  return updates;
}

/** Derives every reporter-thread update whose state has been reached. */
export function threadUpdates({ signals, experiments, appUrl }: ThreadUpdatesInput): ThreadUpdate[] {
  const updates: ThreadUpdate[] = [];
  for (const signal of signals) {
    const threads = reporterThreads(signal.evidence);
    if (threads.length === 0) continue;
    const experiment = latestExperiment(experiments.filter((item) => item.signalId === signal.id));
    const stages: Array<{ stage: ThreadUpdateStage; text: string }> = [];
    if (signal.status !== "dismissed" && signal.status !== "stale" && signal.kind) {
      stages.push({
        stage: "received",
        text: signal.kind === "bug"
          ? `Got it. Kismet is looking into this as a bug: “${signal.title}”.`
          : `Got it. Kismet filed this under “${signal.title}”. It acts on ideas once a few more people ask for them, or when someone starts it in Kismet.`,
      });
    }
    if (experiment) stages.push(...experimentUpdates(experiment, appUrl));
    for (const stage of stages) {
      for (const thread of threads) {
        const key = stage.stage === "received"
          ? `received:${signal.id}:${thread.channelId}:${thread.threadTs}`
          : stage.stage === "merged" && experiment?.kind === "fix"
            ? `reporter_reply:${experiment.id}:${thread.channelId}:${thread.threadTs}`
            : `${stage.stage}:${experiment!.id}:${thread.channelId}:${thread.threadTs}`;
        updates.push({
          ...thread,
          ...stage,
          key,
          ...(stage.stage === "review" && experiment ? { actionsFor: experiment.id } : {}),
        });
      }
    }
  }
  return updates;
}
