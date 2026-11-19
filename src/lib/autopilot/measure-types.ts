export interface MeasurePoint {
  day: string;
  [series: string]: string | number | null;
}

export interface MeasureTotal {
  visitors: number;
  conversions: number;
  rate: number | null;
}

export interface MeasureChart {
  mode: "arms" | "before_after";
  series: MeasurePoint[];
  totals: Record<string, MeasureTotal>;
  changeAt: string | null;
}

export interface MeasureExperimentResponse {
  experiment: {
    id: string;
    title: string;
    kind: "test" | "change" | "fix";
    status: string;
    startedAt: string;
    metric: string;
    guardrail: string | null;
  };
  metric: MeasureChart;
  guardrail: MeasureChart | null;
  totals: Record<string, MeasureTotal>;
}

export interface MeasureOverviewResponse {
  goals: Array<{ id: string; name: string; currentRate: number | null; series: MeasurePoint[] }>;
  running: Array<{
    id: string;
    title: string;
    kind: "test" | "change" | "fix";
    status: string;
    startedAt: string;
    headline: string;
  }>;
}
