import "server-only";

import { describeMetric, type MetricSpec } from "@/lib/autopilot/assign";
import { dailyRates, relativeLift, seriesTotals } from "@/lib/autopilot/measure-core";
import type { MeasureChart, MeasureExperimentResponse, MeasureOverviewResponse } from "@/lib/autopilot/measure-types";
import { dailyMetricCounts, getExperiment, listExperiments, listGoals } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";

const DAY_MS = 86_400_000;

function day(value: string): string {
  return value.slice(0, 10);
}

function endExclusive(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

async function chartFor(experiment: Experiment, spec: MetricSpec, to: string): Promise<MeasureChart> {
  const startedAt = experiment.startedAt!;
  const arms = experiment.kind === "test";
  const from = arms ? startedAt : new Date(Date.parse(startedAt) - 14 * DAY_MS).toISOString();
  const names = arms ? ["control", "treatment"] : ["before", "after"];
  const rows = await dailyMetricCounts(spec, from, to, arms ? { flag: experiment.flag } : { splitAt: startedAt });
  return {
    mode: arms ? "arms" : "before_after",
    series: dailyRates(rows, names, day(from), day(new Date(Date.parse(to) - 1).toISOString())),
    totals: seriesTotals(rows, names),
    changeAt: arms ? null : startedAt,
  };
}

export async function experimentMeasure(id: string): Promise<MeasureExperimentResponse | null> {
  const experiment = await getExperiment(id);
  if (!experiment?.startedAt || !experiment.metricSpec) return null;
  const to = endExclusive();
  const [charted, guardrail] = await Promise.all([
    chartFor(experiment, experiment.metricSpec, to),
    experiment.guardrailSpec ? chartFor(experiment, experiment.guardrailSpec, to) : null,
  ]);
  // The experiment page shows the readout; show the same numbers here so the two never disagree.
  const metric = charted.mode === "arms" && experiment.readout?.arms.length
    ? {
        ...charted,
        totals: Object.fromEntries(experiment.readout.arms.map((arm) => [
          arm.arm,
          { visitors: arm.visitors, conversions: arm.conversions, rate: arm.rate },
        ])),
      }
    : charted;
  return {
    experiment: {
      id: experiment.id, title: experiment.title, kind: experiment.kind, status: experiment.status,
      startedAt: experiment.startedAt, metric: describeMetric(experiment.metricSpec),
      guardrail: experiment.guardrailSpec ? describeMetric(experiment.guardrailSpec) : null,
    },
    metric,
    guardrail,
    totals: metric.totals,
  };
}

function headline(experiment: Experiment): string {
  if (experiment.kind === "fix") return "watching for new complaints";
  if (experiment.readout) {
    const control = experiment.readout.arms.find((arm) => arm.arm === "control")?.rate ?? null;
    const treatment = experiment.readout.arms.find((arm) => arm.arm === "treatment")?.rate ?? null;
    const lift = experiment.readout.lift ?? relativeLift(control, treatment);
    if (lift != null) return `${lift >= 0 ? "+" : ""}${Math.round(lift * 100)}% vs control`;
  }
  if (experiment.directional) {
    const before = experiment.directional.before;
    const after = experiment.directional.after;
    const lift = relativeLift(before.visitors ? before.conversions / before.visitors : null, after.visitors ? after.conversions / after.visitors : null);
    if (lift != null) return `${lift >= 0 ? "+" : ""}${Math.round(lift * 100)}% since change`;
  }
  return experiment.status === "rolling_out" ? "rolling out · still measuring" : "collecting visitors";
}

export async function measureOverview(now = new Date()): Promise<MeasureOverviewResponse> {
  const [goals, experiments] = await Promise.all([listGoals(), listExperiments()]);
  const to = endExclusive(now);
  const from = new Date(Date.parse(to) - 30 * DAY_MS).toISOString();
  const goalRows = await Promise.all(goals.map(async (goal) => {
    const rows = await dailyMetricCounts(goal.spec, from, to, { splitAt: from });
    const series = dailyRates(rows, ["after"], day(from), day(new Date(Date.parse(to) - 1).toISOString()))
      .map(({ day: pointDay, after }) => ({ day: pointDay, rate: after }));
    const total = seriesTotals(rows, ["after"]).after;
    return { id: goal.id, name: goal.name, currentRate: total.rate, series };
  }));
  const watched = new Set(["running", "rolling_out", "rolled_out"]);
  const running = experiments
    .filter((experiment) => experiment.startedAt && (watched.has(experiment.status)) && (experiment.status !== "rolled_out" || experiment.kind === "fix"))
    .map((experiment) => ({
      id: experiment.id, title: experiment.title, kind: experiment.kind, status: experiment.status,
      startedAt: experiment.startedAt!, headline: headline(experiment),
    }));
  return { goals: goalRows, running };
}
