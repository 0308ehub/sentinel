export type ExploreKind = "line" | "area" | "bar" | "metric" | "table" | "funnel";
export type ExploreMeasure = "uniques" | "totals" | "revenue" | "aov" | "frequency";
export type ExploreBreakdown = "product" | "payment";

/** A cohort of customers. Every field is optional; an empty filter matches everyone. */
export interface SegmentFilter {
  product: string | null;
  payment: string | null;
  minOrders: number;
  customerId: string | null;
  city: string | null;
  state: string | null;
}

export interface FunnelStepInput {
  kind: "any" | "product";
  product?: string;
}

export interface ExploreSpec {
  kind: ExploreKind;
  measure: ExploreMeasure;
  events: string[];
  lastDays: number | null;
  breakdown: ExploreBreakdown;
  steps: FunnelStepInput[];
  withinDays: number | null;
  segment?: SegmentFilter | null;
}

export interface ExploreOptions {
  products: string[];
  payments: string[];
  startDay: string;
  endDay: string;
}

export interface ExploreSeries {
  name: string;
}

export interface ExplorePoint {
  day: string;
  values: Record<string, number>;
}

export interface ExploreBar {
  label: string;
  value: number;
}

export interface ExploreFunnelStep {
  name: string;
  users: number;
  conversion: number;
  fromPrior: number;
  medianSeconds: number | null;
}

export interface ExploreResult {
  kind: ExploreKind;
  measure: ExploreMeasure;
  startDay: string;
  endDay: string;
  series: ExploreSeries[];
  points: ExplorePoint[];
  bars: ExploreBar[];
  steps: ExploreFunnelStep[];
  totalConversion: number | null;
  metricValue: number | null;
  metricPrevious: number | null;
}
