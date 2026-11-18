import type { MetricSpec } from "@/lib/autopilot/assign";
import type { OutsideBuilder } from "@/lib/autopilot/builders";
import type { ResultEstimate } from "@/lib/autopilot/power";
import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import type { Theme } from "@/lib/autopilot/themes";

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

export type SignalStatus = "open" | "experimenting" | "resolved" | "dismissed" | "stale";

export interface Signal {
  id: string;
  title: string;
  problem: string;
  area: string;
  status: SignalStatus;
  createdAt: string;
  updatedAt: string;
  evidence: Evidence[];
  /** Distinct observations: the same finding measured again counts once. */
  distinctEvidence: number;
  /** Attached observations that are too old to support this problem now. */
  staleEvidence: number;
  sources: EvidenceSource[];
  ready: boolean;
  snoozedUntil: string | null;
}

export interface Goal {
  id: string;
  name: string;
  spec: MetricSpec;
  source: "inferred" | "person";
  createdAt: string;
  baselineRate: number;
  weeklyVisitors: number;
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
  /** Running minimum of the always-valid mSPRT p-value. */
  sequentialP: number | null;
  srm?: {
    pValue: number;
    expected: [number, number];
    observed: [number, number];
  };
  /** Prevents repeated activity entries if a mismatch clears and later returns. */
  srmLogged?: boolean;
  guardrail?: {
    control: ArmResult;
    treatment: ArmResult;
    pValue: number | null;
    worse: boolean;
  };
  minimumDays: number;
  verdict: "collecting" | "won" | "lost" | "flat";
  /** Set when this result depends on which version of another running experiment visitors saw. */
  interaction: string | null;
  syntheticShare: number;
  at: string;
}

export interface ChangeRationale {
  reasoning: string;
  evidence: Array<{ source: string; quote: string }>;
  confidence: "high" | "medium";
  confidenceReason: string;
  risks: string;
  question?: string;
}

export interface DirectionalResult {
  before: { visitors: number; conversions: number };
  after: { visitors: number; conversions: number };
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
  kind: "test" | "change";
  title: string;
  hypothesis: string;
  metric: string;
  metricSpec: MetricSpec | null;
  guardrailSpec: MetricSpec | null;
  /** The page the change appears on, used to keep experiments on the same page apart. */
  page: string;
  /** How this experiment shares traffic with others, or what it waits for, in plain words. */
  overlap: string | null;
  guardrail: string;
  control: string;
  treatment: string;
  changeSummary: ChangeSummary | null;
  flag: string;
  status: ExperimentStatus;
  rejectedBy: "person" | "kismet" | null;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  note: string | null;
  readout: Readout | null;
  rationale: ChangeRationale | null;
  directional: DirectionalResult | null;
  estimate: ResultEstimate | null;
  /** The file the change edits. In dry-run mode the change is stored, not pushed. */
  draftPath: string | null;
  coderSessionId: string | null;
  agentFailed: boolean;
  /** Set when the account's own coding agent writes the change: which one, its run, and where to watch it. */
  builder: OutsideBuilder | null;
  buildRef: string | null;
  buildUrl: string | null;
  buildStartedAt: string | null;
  cleanup: Cleanup | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export type LearningOutcome = "won" | "lost" | "flat" | "inconclusive" | "rejected" | "directional";

export interface Learning {
  id: string;
  experimentId: string;
  signalId: string | null;
  kind: "result" | "rejected";
  outcome: LearningOutcome;
  title: string;
  page: string;
  metric: string;
  change: string;
  lift: number | null;
  pValue: number | null;
  visitors: number | null;
  learning: string;
  createdAt: string;
}

export interface Activity {
  id: number;
  at: string;
  kind: string;
  message: string;
  ref: string | null;
}

export type SuggestionRatingValue = "good" | "not_useful";
export type SuggestionTargetKind = "signal" | "experiment";

export interface SuggestionRating {
  id: string;
  targetKind: SuggestionTargetKind;
  targetId: string;
  rating: SuggestionRatingValue;
  reason: string | null;
  title: string;
  createdAt: string;
}

export interface AutopilotState {
  configured: boolean;
  error?: string;
  signals: Signal[];
  themes: Theme[];
  ratings: SuggestionRating[];
  experiments: Experiment[];
  learnings: Learning[];
  goals: Goal[];
  activity: Activity[];
  lastRunAt: string | null;
  synthetic: boolean;
  dryRun: boolean;
  /** Where this account's changes go; null until the account chooses a repository. */
  repo: string | null;
  /** Synthetic evidence this account still holds, of any age. */
  sampleEvidence: number;
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
