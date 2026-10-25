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
  syntheticShare: number;
  at: string;
}

export interface Experiment {
  id: string;
  signalId: string;
  version: number;
  title: string;
  hypothesis: string;
  metric: string;
  guardrail: string;
  control: string;
  treatment: string;
  flag: string;
  status: ExperimentStatus;
  prUrl: string | null;
  prNumber: number | null;
  note: string | null;
  readout: Readout | null;
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
