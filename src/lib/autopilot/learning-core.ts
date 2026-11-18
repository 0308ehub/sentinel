import type { Experiment, Learning, LearningOutcome } from "@/lib/autopilot/types";

export function outcomeFor(experiment: Experiment): LearningOutcome {
  if (experiment.status === "rejected" && experiment.rejectedBy !== "kismet") return "rejected";
  if (experiment.kind === "change" && experiment.startedAt) return "directional";
  const verdict = experiment.readout?.verdict;
  if (experiment.status === "rolled_out") {
    return verdict === "lost" || verdict === "flat" ? verdict : "won";
  }
  if (experiment.status === "stopped" && (verdict === "won" || verdict === "lost" || verdict === "flat")) {
    return verdict;
  }
  return "inconclusive";
}

function percent(value: number): string {
  return `${Math.abs(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function evidence(experiment: Experiment): string {
  const readout = experiment.readout;
  if (!readout) return "";
  const visitors = readout.arms.reduce((sum, arm) => sum + arm.visitors, 0);
  const details = [
    readout.pValue == null ? null : `p=${readout.pValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`,
    visitors ? `${visitors.toLocaleString("en-US")} visitors` : null,
  ].filter(Boolean);
  return details.length ? ` (${details.join(", ")})` : "";
}

export function fallbackLearning(experiment: Experiment, outcome: LearningOutcome): string {
  const change = experiment.treatment || "the treatment";
  const page = experiment.page || "the tested page";
  const metric = experiment.metric || "the target metric";
  const lift = experiment.readout?.lift;
  if (outcome === "directional") {
    const before = experiment.directional?.before;
    const after = experiment.directional?.after;
    const rate = (count: typeof before) => count?.visitors ? `${(count.conversions / count.visitors * 100).toFixed(1)}%` : "—";
    return `After shipping ${change} to everyone on ${page}, ${metric} moved from ${rate(before)} to ${rate(after)} (not a controlled test).`;
  }
  if (outcome === "rejected") return `A person rejected this change before it ran: ${change}.`;
  if (outcome === "flat") return `Showing ${change} on ${page} made no measurable difference to ${metric}${evidence(experiment)}.`;
  if (outcome === "inconclusive") return `Showing ${change} on ${page} did not collect enough evidence to determine its effect on ${metric}${evidence(experiment)}.`;
  const direction = outcome === "won" ? "raised" : "lowered";
  const amount = lift == null ? "" : ` by ${percent(lift)}`;
  return `Showing ${change} on ${page} ${direction} ${metric}${amount}${evidence(experiment)}.`;
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function relevantLearnings(
  learnings: Learning[],
  context: { page: string; area: string },
  limit = 12,
): Learning[] {
  const areaWords = words(context.area);
  const score = (learning: Learning): number => {
    if (context.page && learning.page === context.page) return 2;
    if (areaWords.size > 0 && [...words(`${learning.page} ${learning.title}`)].some((word) => areaWords.has(word))) return 1;
    return 0;
  };
  return [...learnings]
    .sort((a, b) => score(b) - score(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(0, limit));
}
