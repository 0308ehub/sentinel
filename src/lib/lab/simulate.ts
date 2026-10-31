import { mulberry32, sampleBinomial, sampleNormal, samplePoisson } from "./stats.ts";
import type { CompanyContext, DailyArm, Design, MetricId, ScenarioTruth } from "./types.ts";
import { PANTRY } from "./company.ts";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function simulateDay(
  design: Design,
  truth: ScenarioTruth,
  day: number,
  seed: number,
  company: CompanyContext = PANTRY,
): DailyArm[] {
  const rows: DailyArm[] = [];
  for (const plan of design.segments.filter((s) => s.included))
    for (const variant of design.variants) {
      const rng = mulberry32(hash(`${seed}:${day}:${plan.segment}:${variant.id}`));
      const expected = company.dailyTraffic[plan.segment] * design.allocation * variant.weight;
      const visitors = Math.max(1, samplePoisson(rng, expected));
      const metrics: DailyArm["metrics"] = {};
      for (const [id, def] of Object.entries(company.metrics) as [MetricId, CompanyContext["metrics"][MetricId]][]) {
        const effect = variant.id === "control" ? 0 : (truth[id]?.[plan.segment] ?? 0);
        const mean = Math.max(1e-9, def.baseline[plan.segment] * (1 + effect));
        if (def.kind === "binary") {
          const sum = sampleBinomial(rng, visitors, Math.min(0.999999, mean));
          metrics[id] = { sum, sumSq: sum, n: visitors };
        } else {
          const sd = def.sd?.[plan.segment] ?? Math.max(0.01, mean);
          const sampleMean = sampleNormal(rng, mean, sd / Math.sqrt(visitors));
          const variance = sd * sd;
          metrics[id] = {
            sum: sampleMean * visitors,
            sumSq: variance * (visitors - 1) + sampleMean * sampleMean * visitors,
            n: visitors,
          };
        }
      }
      rows.push({ day, arm: variant.id, segment: plan.segment, visitors, metrics });
    }
  return rows;
}

export function cumulative(dailies: DailyArm[], upToDay: number): DailyArm[] {
  const groups = new Map<string, DailyArm>();
  for (const row of dailies.filter((d) => d.day <= upToDay)) {
    const key = `${row.arm}:${row.segment}`;
    const prior = groups.get(key) ?? { day: upToDay, arm: row.arm, segment: row.segment, visitors: 0, metrics: {} };
    const metrics = { ...prior.metrics };
    for (const [id, value] of Object.entries(row.metrics) as [MetricId, NonNullable<DailyArm["metrics"][MetricId]>][]) {
      const old = metrics[id] ?? { sum: 0, sumSq: 0, n: 0 };
      metrics[id] = { sum: old.sum + value.sum, sumSq: old.sumSq + value.sumSq, n: old.n + value.n };
    }
    groups.set(key, { ...prior, visitors: prior.visitors + row.visitors, metrics });
  }
  return [...groups.values()];
}
