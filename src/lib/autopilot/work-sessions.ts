import type { Experiment } from "@/lib/autopilot/types";
import { stageLabel } from "./build-stage-core.ts";

export type WorkMark = "blue" | "dashed" | "dot";
export type WorkTone = "green" | "orange" | "muted";
export type WorkBucket = "review" | "ready" | "working" | "running" | "quiet";

export interface WorkSession {
  id: string;
  title: string;
  hint: string;
  mark: WorkMark;
  /** Status phrase. When absent, the row shows the age instead. */
  line: { text: string; tone: WorkTone } | null;
  age: string;
  /** Open pull request for this experiment. */
  pulls: number;
  /** Follow-up pull request, such as removing the switch after a decision. */
  followUps: number;
  clock: boolean;
  canStop: boolean;
  bucket: WorkBucket;
  updated: number;
}

export function workSession(experiment: Experiment, now = Date.now()): WorkSession {
  const updated = Date.parse(experiment.endedAt || experiment.startedAt || experiment.buildStartedAt || experiment.createdAt);
  const since = experiment.buildStartedAt || experiment.createdAt;
  const previewWaiting = (experiment.note ?? "").includes("Waiting for the preview build");
  const previewPassed = (experiment.note ?? "").includes("Preview build passed");
  const hasPull = Boolean(experiment.prUrl || experiment.prNumber);
  const followUp = experiment.cleanup?.prUrl && (experiment.cleanup.status === "awaiting" || experiment.cleanup.status === "building") ? 1 : 0;
  const base = {
    id: experiment.id,
    title: experiment.title,
    hint: experiment.page ? `${experiment.page} · ${experiment.hypothesis}` : experiment.hypothesis,
    pulls: hasPull ? 1 : 0,
    followUps: followUp,
    updated: Number.isNaN(updated) ? now : updated,
  };

  if (experiment.status === "building" || experiment.cleanup?.status === "building") {
    const working = experiment.status === "building" && experiment.buildStage
      ? stageLabel(experiment.buildStage)
      : "Working";
    return {
      ...base,
      mark: "dashed",
      line: { text: `${working} · ${ageLabel(since, now)}`, tone: "muted" },
      age: ageLabel(since, now),
      clock: true,
      canStop: experiment.status === "building" || experiment.status === "awaiting_approval",
      bucket: "working",
    };
  }

  if (experiment.status === "awaiting_approval") {
    const readyForReview = (hasPull || Boolean(experiment.draftPath)) && (previewPassed || !previewWaiting);
    if (!readyForReview && hasPull) {
      return { ...base, mark: "dashed", line: { text: "PR is ready", tone: "green" }, age: ageLabel(base.updated, now), clock: false, canStop: true, bucket: "ready" };
    }
    return {
      ...base,
      mark: "blue",
      line: { text: hasPull ? "Review PR" : "Review change", tone: "orange" },
      age: ageLabel(base.updated, now),
      clock: false,
      canStop: true,
      bucket: "review",
    };
  }

  if (experiment.cleanup?.status === "awaiting") {
    return { ...base, mark: "blue", line: { text: "Review PR", tone: "orange" }, age: ageLabel(base.updated, now), clock: false, canStop: false, bucket: "review" };
  }

  if (experiment.status === "running" || experiment.status === "rolling_out" || experiment.status === "queued") {
    const progress = progressLabel(experiment, now);
    const text = experiment.status === "queued"
      ? "Waiting"
      : progress
        ? `${experiment.status === "rolling_out" ? "Rolling out" : "Running"} · ${progress}`
        : experiment.status === "rolling_out"
          ? "Rolling out"
          : "";
    return {
      ...base,
      mark: experiment.status === "queued" ? "dot" : "blue",
      line: text ? { text, tone: "muted" } : null,
      age: ageLabel(experiment.startedAt || experiment.createdAt, now),
      clock: false,
      canStop: false,
      bucket: "running",
    };
  }

  if (experiment.status === "awaiting_rollout") {
    return { ...base, mark: "blue", line: { text: "Review result", tone: "orange" }, age: ageLabel(base.updated, now), clock: false, canStop: false, bucket: "review" };
  }

  if (experiment.status === "rejected" && experiment.rejectedBy === "kismet" && experiment.note?.startsWith("No change needed:")) {
    return { ...base, mark: "dot", line: { text: "No change needed", tone: "muted" }, age: ageLabel(base.updated, now), clock: false, canStop: false, bucket: "quiet" };
  }

  return {
    ...base,
    mark: "dot",
    line: experiment.status === "failed" ? { text: "Failed", tone: "muted" } : null,
    age: ageLabel(base.updated, now),
    clock: false,
    canStop: false,
    bucket: "quiet",
  };
}

export function ageLabel(value: string | number, now = Date.now()): string {
  const at = typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(at)) return "just now";
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((now - at) / 3_600_000);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round((now - at) / 86_400_000);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function progressLabel(experiment: Experiment, now: number): string | null {
  if (experiment.status === "rolling_out" && experiment.rollout?.length) {
    const current = [...experiment.rollout].reverse().find((phase) => Date.parse(phase.at) <= now) ?? experiment.rollout[0];
    return `${current.pass}%`;
  }
  if (experiment.status !== "running") return null;
  const visitors = (experiment.readout?.arms ?? []).reduce((sum, arm) => sum + arm.visitors, 0);
  if (experiment.kind === "test" && experiment.estimate && visitors > 0) {
    const target = experiment.estimate.perArm * 2;
    if (target > 0) return `${Math.min(100, Math.round((visitors / target) * 100))}%`;
  }
  if (experiment.kind === "change" && experiment.directional && experiment.directional.before.visitors > 0) {
    return `${Math.min(100, Math.round((experiment.directional.after.visitors / experiment.directional.before.visitors) * 100))}%`;
  }
  if (experiment.kind === "test" && experiment.estimate && experiment.startedAt && experiment.estimate.days > 0) {
    const days = (now - Date.parse(experiment.startedAt)) / 86_400_000;
    return `${Math.min(99, Math.round((days / experiment.estimate.days) * 100))}%`;
  }
  return null;
}
