import type { ExperimentStatus, SignalStatus } from "./types";

export interface RunSnapshot {
  signals: { id: string; title: string; status: SignalStatus; kind: "bug" | "idea" | null }[];
  experiments: { id: string; title: string; status: ExperimentStatus }[];
  evidenceBySource: Record<string, number>;
}

export interface RunReport {
  headline: string;
  looked: string[];
  suggested: { id: string; title: string; byKismet: boolean }[];
  moved: { id: string; title: string; from: string; to: string }[];
  notes: string[];
  errors: string[];
}

const STATUS_LABELS: Record<ExperimentStatus, string> = {
  building: "Building",
  awaiting_approval: "Ready for review",
  queued: "Queued",
  running: "Running",
  awaiting_rollout: "Ready to roll out",
  rolling_out: "Rolling out",
  rolled_out: "Rolled out",
  stopped: "Stopped",
  rejected: "Rejected",
  failed: "Failed",
};

const SOURCE_LABELS: Record<string, string> = {
  slack: "Slack messages",
  ticket: "tickets",
  analytics: "analytics findings",
  interview: "interview notes",
  google: "Google Docs, Calendar or Gmail items",
};

function countPhrase(count: number, label: string): string {
  const singular = label.endsWith("s") ? label.slice(0, -1) : label;
  return `${count} new ${count === 1 ? singular : label}`;
}

function representedStep(step: string): boolean {
  return /^(Collected|Sorted|Triaged|Updated|Started|Advanced|Measured|Learned|Suggested)\b/i.test(step);
}

export function buildRunReport(
  before: RunSnapshot,
  after: RunSnapshot,
  steps: string[],
  errors: string[],
  ideaSignalIds: ReadonlySet<string> = new Set(),
): RunReport {
  const previousSignals = new Set(before.signals.map((signal) => signal.id));
  const suggested = after.signals
    .filter((signal) => !previousSignals.has(signal.id) && signal.status === "open")
    .map((signal) => ({ id: signal.id, title: signal.title, byKismet: ideaSignalIds.has(signal.id) }));

  const previousExperiments = new Map(before.experiments.map((experiment) => [experiment.id, experiment]));
  const moved = after.experiments.flatMap((experiment) => {
    const previous = previousExperiments.get(experiment.id);
    if (previous?.status === experiment.status) return [];
    return [{
      id: experiment.id,
      title: experiment.title,
      from: previous ? STATUS_LABELS[previous.status] : "New",
      to: STATUS_LABELS[experiment.status],
    }];
  });

  const looked = Object.entries(after.evidenceBySource)
    .filter(([source, count]) => source !== "kismet" && count > (before.evidenceBySource[source] ?? 0))
    .map(([source, count]) => countPhrase(count - (before.evidenceBySource[source] ?? 0), SOURCE_LABELS[source] ?? `${source} items`));
  const running = before.experiments.filter((experiment) => experiment.status === "running").length;
  if (running) looked.push(`Checked ${running} running experiment${running === 1 ? "" : "s"}`);

  const headlineParts: string[] = [];
  if (suggested.length) headlineParts.push(`${suggested.length} new suggestion${suggested.length === 1 ? "" : "s"}`);
  if (moved.length) headlineParts.push(`${moved.length} change${moved.length === 1 ? "" : "s"} moved`);

  return {
    headline: headlineParts.length ? headlineParts.join(", ") : "Nothing new since the last check",
    looked,
    suggested,
    moved,
    notes: steps.filter((item) => !representedStep(item)),
    errors: [...errors],
  };
}
