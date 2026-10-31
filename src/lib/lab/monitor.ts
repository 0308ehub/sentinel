import { PANTRY } from "./company.ts";
import { compareBinary, compareContinuous, conditionalPower, srmPValue } from "./stats.ts";
import { launchUpdate, lookUpdate } from "./narrate.ts";
import { cumulative, simulateDay } from "./simulate.ts";
import type {
  CompanyContext,
  DailyArm,
  DailyPoint,
  Design,
  GuardrailResult,
  LookResult,
  MetricId,
  ScenarioTruth,
  SegmentResult,
  StopReason,
  Update,
} from "./types.ts";

/** One-sided 99% for guardrails: stricter than the primary metric, since they can stop a test. */
const Z_99 = 2.326;

function combine(rows: DailyArm[], arm: "control" | "a" | "b", metric: MetricId, segment?: string) {
  const values = rows
    .filter((r) => r.arm === arm && (!segment || r.segment === segment))
    .map((r) => r.metrics[metric])
    .filter((v) => v !== undefined);
  return values.reduce((a, v) => ({ sum: a.sum + v.sum, sumSq: a.sumSq + v.sumSq, n: a.n + v.n }), {
    sum: 0,
    sumSq: 0,
    n: 0,
  });
}
function comparison(rows: DailyArm[], design: Design, metric: MetricId, company: CompanyContext, segment?: string) {
  const c = combine(rows, "control", metric, segment);
  const t = combine(rows, "a", metric, segment);
  const def = company.metrics[metric];
  return def.kind === "binary"
    ? compareBinary(c.sum, c.n, t.sum, t.n)
    : compareContinuous(c.sum, c.sumSq, c.n, t.sum, t.sumSq, t.n);
}

export function evaluateLook(
  design: Design,
  data: DailyArm[],
  look: number,
  company: CompanyContext = PANTRY,
): LookResult {
  const boundary = design.boundaries[look - 1]!;
  const primary = comparison(data, design, design.primaryMetric, company);
  const counts = design.variants.map((v) => data.filter((r) => r.arm === v.id).reduce((sum, r) => sum + r.visitors, 0));
  const srmP = srmPValue(
    counts,
    design.variants.map((v) => v.weight),
  );
  const guardrails: GuardrailResult[] = design.guardrails.map((g) => {
    const result = comparison(data, design, g.metric, company);
    const higher = company.metrics[g.metric].higherIsBetter;
    const harm = higher ? -result.lift : result.lift;
    const relativeSe = (result.ciHigh - result.ciLow) / 3.92;
    const harmLower99 = harm - Z_99 * relativeSe;
    const harmUpper99 = harm + Z_99 * relativeSe;
    // Breached: confidently harmful and by more than the allowed margin.
    const breached = harmLower99 > 0 && harm > g.margin;
    // Watch: past the margin but not yet confidently so.
    const watch = !breached && harm > g.margin && harmUpper99 > g.margin;
    return {
      metric: g.metric,
      lift: result.lift,
      ciLow: result.ciLow,
      ciHigh: result.ciHigh,
      breached,
      status: breached ? "breached" : watch ? "watch" : "ok",
    };
  });
  const segments: SegmentResult[] = design.segments
    .filter((s) => s.included)
    .map((s) => {
      const result = comparison(data, design, s.successMetric, company, s.segment);
      const c = combine(data, "control", s.successMetric, s.segment);
      const t = combine(data, "a", s.successMetric, s.segment);
      return {
        segment: s.segment,
        metric: s.successMetric,
        lift: result.lift,
        ciLow: result.ciLow,
        ciHigh: result.ciHigh,
        pValue: result.pValue,
        n: c.n + t.n,
      };
    });
  let crossed: LookResult["crossed"] = null;
  if (srmP >= 0.001) {
    if (guardrails.some((g, i) => g.breached && design.guardrails[i]!.action === "stop")) crossed = "harm";
    else if (primary.z >= boundary.efficacyZ) crossed = "efficacy";
    else if (primary.z <= -boundary.efficacyZ) crossed = "harm";
    else if (look >= 2 && conditionalPower(primary.z, boundary.infoFraction) < 0.1) crossed = "futility";
  }
  return {
    look,
    day: design.lookDays[look - 1]!,
    z: primary.z,
    lift: primary.lift,
    ciLow: primary.ciLow,
    ciHigh: primary.ciHigh,
    pValue: primary.pValue,
    boundaryZ: boundary.efficacyZ,
    crossed,
    guardrails,
    srmP,
    segments,
  };
}

export interface RunResult {
  looks: LookResult[];
  /** The primary metric every day, for the live chart. Only looks can stop the test. */
  daily: DailyPoint[];
  stopDay: number;
  stopReason: StopReason;
  updates: Update[];
}

export function runExperiment(
  design: Design,
  truth: ScenarioTruth,
  seed = 18,
  company: CompanyContext = PANTRY,
): RunResult {
  const rows: DailyArm[] = [];
  const looks: LookResult[] = [];
  const daily: DailyPoint[] = [];
  const updates: Update[] = [launchUpdate(design, company)];
  for (let day = 1; day <= design.durationDays; day++) {
    rows.push(...simulateDay(design, truth, day, seed, company));
    const data = cumulative(rows, day);
    const primary = comparison(data, design, design.primaryMetric, company);
    daily.push({ day, lift: primary.lift, ciLow: primary.ciLow, ciHigh: primary.ciHigh, z: primary.z });
    const lookIndex = design.lookDays.indexOf(day);
    if (lookIndex < 0) continue;
    const result = evaluateLook(design, data, lookIndex + 1, company);
    looks.push(result);
    updates.push(lookUpdate(design, result, company));
    if (result.srmP < 0.001) return { looks, daily, stopDay: day, stopReason: "srm", updates };
    if (result.crossed) return { looks, daily, stopDay: day, stopReason: result.crossed, updates };
  }
  return { looks, daily, stopDay: design.durationDays, stopReason: "completed", updates };
}
