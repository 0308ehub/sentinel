export type Objective = "retention" | "engagement" | "monetization" | "conversion";
export type SegmentId = "new" | "casual" | "power" | "premium";
export type MetricId =
  | "d7_return"
  | "completion"
  | "engaged_minutes"
  | "ad_revenue"
  | "premium_start"
  | "recipes_saved"
  | "page_load_p75"
  | "error_rate"
  | "refund_rate";

export interface MetricDef {
  id: MetricId;
  label: string;
  kind: "binary" | "continuous";
  unit: "%" | "min" | "$" | "ms" | "count";
  higherIsBetter: boolean;
  baseline: Record<SegmentId, number>;
  sd?: Record<SegmentId, number>;
}
export interface Guardrail {
  metric: MetricId;
  margin: number;
  action: "stop" | "block_ship";
  reason: string;
}
export interface SegmentPlan {
  segment: SegmentId;
  included: boolean;
  successMetric: MetricId;
  why: string;
}
export interface Variant {
  id: "control" | "a" | "b";
  name: string;
  description: string;
  weight: number;
  /** before = today's code, after = the flagged change, shipped = the code once the flag is removed. */
  diff?: { file: string; before: string; after: string; shipped?: string };
}
export interface Evidence {
  id: string;
  source: "analytics" | "support" | "sessions" | "codebase" | "past_experiment" | "goals";
  title: string;
  detail: string;
  metric?: string;
}
export interface Proposal {
  id: string;
  title: string;
  objective: Objective;
  hypothesis: string;
  why: string;
  evidenceIds: string[];
  page: string;
  files: string[];
  expectedLift: number;
  confidence: "low" | "medium" | "high";
  impactScore: number;
  risk: string;
  /** What the treatment changes, in one sentence. */
  treatment: string;
  /** The code change behind the flag, shown in the plan and in the ship PR. */
  diff?: Variant["diff"];
  /** What Kismet tries next if this one loses or shows nothing. */
  followUp?: string;
  /** Set when Kismet considered the idea and chose not to test it. */
  skippedReason?: string;
}
export interface Design {
  proposalId: string;
  objective: Objective;
  primaryMetric: MetricId;
  mde: number;
  alpha: number;
  power: number;
  perArm: number;
  maxPerArm: number;
  dailyEligible: number;
  allocation: number;
  /** Why this share of traffic, in plain words. */
  trafficNote: string;
  durationDays: number;
  looks: number;
  lookDays: number[];
  boundaries: { look: number; infoFraction: number; efficacyZ: number; futilityCp: number | null }[];
  significanceRule: string;
  guardrails: Guardrail[];
  segments: SegmentPlan[];
  variants: Variant[];
  /** Carried from the proposal so the readout can suggest what comes next. */
  followUp?: string;
}
export interface DailyArm {
  day: number;
  arm: Variant["id"];
  segment: SegmentId;
  visitors: number;
  metrics: Partial<Record<MetricId, { sum: number; sumSq: number; n: number }>>;
}
export interface DailyPoint {
  day: number;
  lift: number;
  ciLow: number;
  ciHigh: number;
  z: number;
}
export interface GuardrailResult {
  metric: MetricId;
  lift: number;
  ciLow: number;
  ciHigh: number;
  breached: boolean;
  status: "ok" | "watch" | "breached";
}
export interface SegmentResult {
  segment: SegmentId;
  metric: MetricId;
  lift: number;
  ciLow: number;
  ciHigh: number;
  pValue: number;
  n: number;
}
export interface LookResult {
  look: number;
  day: number;
  z: number;
  lift: number;
  ciLow: number;
  ciHigh: number;
  pValue: number;
  boundaryZ: number;
  crossed: "efficacy" | "harm" | "futility" | null;
  guardrails: GuardrailResult[];
  srmP: number;
  segments: SegmentResult[];
}
export type ExperimentStage =
  | "proposed"
  | "designed"
  | "queued"
  | "running"
  | "stopped"
  | "decided"
  | "shipping"
  | "shipped"
  | "rejected";
export type StopReason = "efficacy" | "harm" | "futility" | "completed" | "srm" | "manual";
export interface Update {
  id: string;
  day: number;
  at: string;
  agent: "scout" | "designer" | "analyst" | "shipper";
  kind: "info" | "milestone" | "warning" | "decision";
  title: string;
  body: string;
}
export interface Readout {
  winner: Variant["id"] | null;
  recommendation: "ship_all" | "ship_segment" | "iterate" | "kill";
  shipSegments: SegmentId[];
  headline: string;
  summary: string[];
  primary: { lift: number; ciLow: number; ciHigh: number; pValue: number };
  guardrails: GuardrailResult[];
  segments: SegmentResult[];
  daysSaved: number;
  learnings: string[];
  nextIdea: string;
}

export interface PastExperiment {
  title: string;
  date: string;
  result: string;
}
export interface CompanyContext {
  name: string;
  pitch: string;
  businessModel: string;
  northStar: string;
  goals: string[];
  dailyTraffic: Record<SegmentId, number>;
  metrics: Record<MetricId, MetricDef>;
  evidence: Evidence[];
  codebase: Record<string, string>;
  pastExperiments: PastExperiment[];
  /** Two experiments conflict when they edit the same file; the later one waits. */
  conflicts: (a: Proposal, b: Proposal) => boolean;
}
export type ScenarioTruth = Partial<Record<MetricId, Partial<Record<SegmentId, number>>>>;
export interface Scenario {
  proposal: Proposal;
  truth: ScenarioTruth;
}
