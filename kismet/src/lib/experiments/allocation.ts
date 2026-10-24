import { blankFilter } from "@/lib/analytics/library";
import type { SegmentFilter } from "@/lib/analytics/explore-types";

export type ExperimentMetric = "conversion" | "orders" | "revenue" | "aov";
export type ExpectedChange = "increase" | "decrease" | "any";
export type ReadoutState = "hold" | "collecting" | "significant" | "no_difference" | "mismatch";

export interface AllocationCohort {
  id: string;
  name: string;
  filter: SegmentFilter;
}

export interface AllocationArm {
  id: string;
  name: string;
  weight: number;
}

export interface ExperimentAllocation {
  rollout: number;
  metric: ExperimentMetric;
  direction: ExpectedChange;
  arms: AllocationArm[];
  cohorts: AllocationCohort[];
}

export interface ArmMeasure {
  id: string;
  name: string;
  percent: number;
  estimated: number;
  users: number;
  converted: number;
  conversion: number | null;
  orders: number;
  revenue: number;
  ordersPerUser: number | null;
  revenuePerUser: number | null;
  aov: number | null;
  ordersSq: number;
  revenueSq: number;
  aovSum: number;
  aovSq: number;
  lift: number | null;
  pValue: number | null;
  ciLow: number | null;
  ciHigh: number | null;
}

export interface MetricCheck {
  metric: ExperimentMetric;
  state: ReadoutState;
}

export interface ExperimentReadout {
  startDay: string;
  endDay: string;
  audience: number;
  metric: ExperimentMetric;
  arms: ArmMeasure[];
  checks: MetricCheck[];
  state: ReadoutState;
  summary: string;
  needed: number | null;
}

export const ROLLOUTS = [0, 1, 5, 10, 50, 100] as const;

export const READOUT_LABEL: Record<ReadoutState, string> = {
  hold: "Not started",
  collecting: "Collecting",
  significant: "Significant",
  no_difference: "Resolved",
  mismatch: "Split mismatch",
};

export const METRIC_LABEL: Record<ExperimentMetric, string> = {
  conversion: "Conversion",
  orders: "Orders per customer",
  revenue: "Revenue per customer",
  aov: "Average order value",
};

const ARM_IDS = ["a", "b", "c"] as const;

export function defaultAllocation(treatment: string, control: string): ExperimentAllocation {
  return {
    rollout: 50,
    metric: "orders",
    direction: "any",
    arms: [{ id: "a", name: shortName(treatment, "Treatment"), weight: 1 }],
    cohorts: [{ id: "all", name: "All customers", filter: blankFilter() }],
  };
}

export function parseAllocation(value: unknown, treatment: string, control: string): ExperimentAllocation {
  const fallback = defaultAllocation(treatment, control);
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<ExperimentAllocation>;
  const rollout = ROLLOUTS.includes(raw.rollout as (typeof ROLLOUTS)[number]) ? (raw.rollout as number) : fallback.rollout;
  const metric = raw.metric && raw.metric in METRIC_LABEL ? raw.metric : fallback.metric;
  const direction = raw.direction === "increase" || raw.direction === "decrease" || raw.direction === "any" ? raw.direction : "any";
  const arms = (Array.isArray(raw.arms) ? raw.arms : [])
    .map((arm, index) => cleanArm(arm, index))
    .filter((arm): arm is AllocationArm => Boolean(arm))
    .slice(0, 3);
  const cohorts = (Array.isArray(raw.cohorts) ? raw.cohorts : [])
    .map((cohort, index) => cleanCohort(cohort, index))
    .filter((cohort): cohort is AllocationCohort => Boolean(cohort))
    .slice(0, 3);
  return {
    rollout,
    metric,
    direction,
    arms: arms.length ? arms : fallback.arms,
    cohorts: cohorts.length ? cohorts : fallback.cohorts,
  };
}

export function shares(rollout: number, arms: AllocationArm[]): { id: string; percent: number }[] {
  const weights = arms.map((arm) => arm.weight);
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let used = 0;
  const variant = arms.map((arm, index) => {
    const percent =
      index === arms.length - 1
        ? round1(rollout - used)
        : round1(rollout * (arm.weight / total));
    used = round1(used + percent);
    return { id: arm.id, percent };
  });
  return [...variant, { id: "control", percent: round1(100 - rollout) }];
}

export function bucketRanges(rollout: number, arms: AllocationArm[]): { id: string; start: number; end: number }[] {
  const total = arms.reduce((sum, arm) => sum + arm.weight, 0) || 1;
  const width = rollout * 100;
  let cursor = 0;
  return arms.map((arm, index) => {
    const span = index === arms.length - 1 ? width - cursor : Math.round(width * (arm.weight / total));
    const start = cursor;
    cursor += span;
    return { id: arm.id, start, end: cursor };
  });
}

export function nextArmId(arms: AllocationArm[]): string | null {
  return ARM_IDS.find((id) => !arms.some((arm) => arm.id === id)) ?? null;
}

export function metricValue(arm: ArmMeasure, metric: ExperimentMetric): number | null {
  if (metric === "conversion") return arm.conversion;
  if (metric === "orders") return arm.ordersPerUser;
  if (metric === "revenue") return arm.revenuePerUser;
  return arm.aov;
}

function cleanArm(value: unknown, index: number): AllocationArm | null {
  if (!value || typeof value !== "object") return null;
  const arm = value as Partial<AllocationArm>;
  const id = ARM_IDS[index];
  if (!id || arm.id !== id) return null;
  const weight = Math.min(20, Math.max(1, Math.floor(Number(arm.weight) || 1)));
  return { id, name: shortName(typeof arm.name === "string" ? arm.name : "", "Treatment"), weight };
}

function cleanCohort(value: unknown, index: number): AllocationCohort | null {
  if (!value || typeof value !== "object") return null;
  const cohort = value as Partial<AllocationCohort>;
  const filter = cohort.filter;
  if (!filter || typeof filter !== "object") return null;
  const name = typeof cohort.name === "string" && cohort.name.trim() ? cohort.name.trim().slice(0, 80) : "Audience";
  return {
    id: typeof cohort.id === "string" && cohort.id.trim() ? cohort.id.slice(0, 40) : `audience-${index + 1}`,
    name,
    filter: {
      product: textOrNull(filter.product),
      payment: textOrNull(filter.payment),
      minOrders: Math.min(30, Math.max(1, Math.floor(Number(filter.minOrders) || 1))),
      customerId: textOrNull(filter.customerId),
      city: textOrNull(filter.city),
      state: textOrNull(filter.state),
    },
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null;
}

function shortName(value: string, fallback: string): string {
  const text = value.trim();
  if (!text || text.length > 40) return fallback;
  return text;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
