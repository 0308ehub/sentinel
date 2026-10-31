import { PANTRY } from "@/lib/lab/company";
import { OBJECTIVES } from "@/lib/lab/design";
import type { ExperimentStage, Objective, Readout, SegmentId, StopReason } from "@/lib/lab/types";

export const AGENT_LABELS = {
  scout: { name: "Scout", color: "#0f9d8a", initials: "S" },
  designer: { name: "Designer", color: "#7c5cdb", initials: "D" },
  analyst: { name: "Analyst", color: "#3b82f6", initials: "A" },
  shipper: { name: "Shipper", color: "#e07a2f", initials: "Sh" },
} as const;

export const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)}%`;

export const objectiveLabel = (objective: Objective) => OBJECTIVES[objective].label;
export const metricLabel = (metric: keyof typeof PANTRY.metrics) => PANTRY.metrics[metric].label;

export const SEGMENT_LABELS: Record<SegmentId, string> = {
  new: "New cooks",
  casual: "Casual cooks",
  power: "Power cooks",
  premium: "Premium cooks",
};

export const STAGE_LABELS: Record<ExperimentStage, string> = {
  proposed: "Proposed",
  designed: "Designed",
  queued: "Queued",
  running: "Running",
  stopped: "Decided",
  decided: "Decided",
  shipping: "Awaiting review",
  shipped: "Shipped",
  rejected: "Not shipped",
};

export const STOP_LABELS: Record<StopReason, string> = {
  efficacy: "Won early",
  harm: "Stopped for harm",
  futility: "Stopped for futility",
  completed: "Ran full length",
  srm: "Stopped for a traffic imbalance",
  manual: "Stopped manually",
};

export function recommendationLabel(readout: Readout): string {
  if (readout.recommendation === "ship_segment") {
    return `Ship to ${readout.shipSegments.map((segment) => SEGMENT_LABELS[segment].toLowerCase()).join(" and ")}`;
  }
  return {
    ship_all: "Ship to everyone",
    kill: "Stopped for harm",
    iterate: "No effect, try next idea",
  }[readout.recommendation];
}

export function semanticTone(value: "win" | "ok" | "watch" | "harm" | "flat") {
  return {
    win: "border-success/25 bg-success/10 text-success",
    ok: "border-success/25 bg-success/10 text-success",
    watch: "border-warning/30 bg-warning/10 text-warning",
    harm: "border-destructive/25 bg-destructive/10 text-destructive",
    flat: "border-border bg-muted text-muted-foreground",
  }[value];
}

export function recommendationTone(recommendation: Readout["recommendation"]) {
  if (recommendation === "ship_all" || recommendation === "ship_segment") return semanticTone("win");
  if (recommendation === "kill") return semanticTone("harm");
  return semanticTone("flat");
}
