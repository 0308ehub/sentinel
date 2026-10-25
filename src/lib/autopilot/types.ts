import type { MetricSpec } from "@/lib/autopilot/assign";

export type EvidenceSource = "slack" | "ticket" | "analytics" | "interview";

export interface Evidence {
  id: string;
  source: EvidenceSource;
  synthetic: boolean;
  title: string;
  body: string;
  author: string;
  url: string | null;
  occurredAt: string;
  signalId: string | null;
}

export type SignalStatus = "open" | "experimenting" | "resolved" | "dismissed";

export interface Signal {
  id: string;
  title: string;
  problem: string;
  area: string;
  status: SignalStatus;
  createdAt: string;
  updatedAt: string;
  evidence: Evidence[];
  sources: EvidenceSource[];
  ready: boolean;
}

export type ExperimentStatus =
  | "building"
  | "awaiting_approval"
  | "queued"
  | "running"
  | "awaiting_rollout"
  | "rolled_out"
  | "stopped"
  | "rejected"
  | "failed";

export interface ArmResult {
  arm: "control" | "treatment";
  visitors: number;
  conversions: number;
  rate: number | null;
}

export interface Readout {
  arms: ArmResult[];
  lift: number | null;
  pValue: number | null;
  verdict: "collecting" | "won" | "lost" | "flat";
  /** Set when this result depends on which version of another running experiment visitors saw. */
  interaction: string | null;
  syntheticShare: number;
  at: string;
}

/**
 * Removing the experiment switch once the decision is made: keep the winner (rolled out) or the
 * original (turned off). "awaiting" means the change is ready and waits for your approval.
 */
export type CleanupStatus = "building" | "awaiting" | "merged" | "closed" | "failed";

export interface Cleanup {
  status: CleanupStatus;
  keep: "control" | "treatment";
  prUrl: string | null;
  prNumber: number | null;
  note: string | null;
}

export interface Experiment {
  id: string;
  signalId: string;
  version: number;
  title: string;
  hypothesis: string;
  metric: string;
  metricSpec: MetricSpec | null;
  /** The page the change appears on, used to keep experiments on the same page apart. */
  page: string;
  /** How this experiment shares traffic with others, or what it waits for, in plain words. */
  overlap: string | null;
  guardrail: string;
  control: string;
  treatment: string;
  flag: string;
  status: ExperimentStatus;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  note: string | null;
  readout: Readout | null;
  /** The file the change edits. In dry-run mode the change is stored, not pushed. */
  draftPath: string | null;
  cleanup: Cleanup | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface Activity {
  id: number;
  at: string;
  kind: string;
  message: string;
  ref: string | null;
}

export interface AutopilotState {
  configured: boolean;
  error?: string;
  signals: Signal[];
  experiments: Experiment[];
  activity: Activity[];
  lastRunAt: string | null;
  synthetic: boolean;
  dryRun: boolean;
  repo: string;
  summary: {
    evidenceThisWeek: number;
    realThisWeek: number;
    readySignals: number;
    running: number;
    needsYou: number;
  };
}

/** A signal is worth an experiment once this much evidence has piled up. */
export const READY_MIN_EVIDENCE = 5;
export const READY_MIN_SOURCES = 2;
