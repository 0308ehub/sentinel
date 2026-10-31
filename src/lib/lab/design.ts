import { inflationFactor, obrienFlemingBoundaries, samplesPerArm } from "./stats.ts";
import type { CompanyContext, Design, Guardrail, MetricId, Proposal, SegmentId, Variant } from "./types.ts";

const objectiveMetrics: Record<Proposal["objective"], MetricId> = {
  retention: "d7_return",
  engagement: "completion",
  monetization: "ad_revenue",
  conversion: "premium_start",
};
/** What each objective optimizes for, and what it deliberately leaves to the guardrails. */
export const OBJECTIVES: Record<
  Proposal["objective"],
  { label: string; optimizingFor: string; notOptimizingFor: string }
> = {
  retention: {
    label: "Retention",
    optimizingFor: "cooks coming back within 7 days",
    notOptimizingFor: "time on page or ad revenue. Ad revenue is a guardrail, not a goal.",
  },
  engagement: {
    label: "Engagement",
    optimizingFor: "cooks finishing the recipe they opened",
    notOptimizingFor:
      "raw minutes on the page, which can rise when a page gets harder to use. Return visits are a guardrail.",
  },
  monetization: {
    label: "Monetization",
    optimizingFor: "ad revenue per cook",
    notOptimizingFor: "revenue at any cost. Return visits, engaged minutes, and Premium starts are guardrails.",
  },
  conversion: {
    label: "Conversion",
    optimizingFor: "free cooks starting a Premium trial",
    notOptimizingFor: "trials that get refunded, or free cooks driven away. Both are guardrails.",
  },
};

/** Margins are relative changes the treatment may not exceed in the harmful direction. */
const defaults: Record<Proposal["objective"], Guardrail[]> = {
  retention: [
    {
      metric: "ad_revenue",
      margin: 0.02,
      action: "block_ship",
      reason: "Retention must not be bought with ad revenue.",
    },
    { metric: "error_rate", margin: 0.1, action: "stop", reason: "A new prompt must not break the recipe page." },
  ],
  engagement: [
    {
      metric: "d7_return",
      margin: 0.015,
      action: "stop",
      reason: "Time spent is worthless if people stop coming back.",
    },
    {
      metric: "page_load_p75",
      margin: 0.08,
      action: "block_ship",
      reason: "About 100ms on a 1.2s page. Slower pages lose readers.",
    },
  ],
  monetization: [
    {
      metric: "d7_return",
      margin: 0.01,
      action: "stop",
      reason: "Revenue that costs return visits shrinks next month's audience.",
    },
    { metric: "engaged_minutes", margin: 0.03, action: "stop", reason: "Ads must not push people off the recipe." },
    {
      metric: "premium_start",
      margin: 0.05,
      action: "block_ship",
      reason: "Ad revenue must not cannibalize Premium.",
    },
  ],
  conversion: [
    { metric: "d7_return", margin: 0.01, action: "stop", reason: "A paywall that drives free cooks away is a loss." },
    {
      metric: "refund_rate",
      margin: 0.1,
      action: "block_ship",
      reason: "Trials that get refunded are not real conversions.",
    },
  ],
};

const ALL_SEGMENTS: SegmentId[] = ["new", "casual", "power", "premium"];
/** Shares of eligible traffic Kismet will try, smallest first, to limit how many people see an untested change. */
const TRAFFIC_SHARES = [0.02, 0.05, 0.1, 0.2, 0.5, 1];
const TARGET_DAYS = 28;
const MAX_DAYS = 28;
const LOOKS = 5;

function wholeWeeks(maxPerArm: number, perDayPerArm: number): number {
  return Math.max(7, Math.ceil(maxPerArm / perDayPerArm / 7) * 7);
}

function pickShare(maxPerArm: number, dailyEligible: number, arms: number): { share: number; days: number } {
  for (const share of TRAFFIC_SHARES) {
    const days = wholeWeeks(maxPerArm, (dailyEligible * share) / arms);
    if (days <= TARGET_DAYS) return { share, days };
  }
  return { share: 1, days: wholeWeeks(maxPerArm, dailyEligible / arms) };
}

/** Premium cooks already pay and see no ads, so ad and Premium tests leave them out. */
function defaultSegments(objective: Proposal["objective"]): SegmentId[] {
  return objective === "monetization" || objective === "conversion" ? ["new", "casual", "power"] : ALL_SEGMENTS;
}

function segmentPlan(segment: SegmentId, included: boolean, primary: MetricId) {
  if (segment === "new")
    return {
      segment,
      included,
      successMetric: "d7_return" as MetricId,
      why: "New cooks are won or lost in their first week, so they are judged on coming back.",
    };
  if (segment === "power")
    return {
      segment,
      included,
      successMetric: "recipes_saved" as MetricId,
      why: "Power cooks already return; for them success is building a recipe box.",
    };
  if (segment === "premium")
    return {
      segment,
      included,
      successMetric: primary,
      why: included
        ? "Premium cooks are judged on the primary metric."
        : "Premium cooks already pay and see no ads, so they are left out.",
    };
  return {
    segment,
    included,
    successMetric: primary,
    why: "Casual cooks are the bulk of traffic and are judged on the primary metric.",
  };
}

export interface DesignOptions {
  allocation?: number;
  mde?: number;
  includedSegments?: SegmentId[];
  variants?: Variant[];
}
export function designExperiment(proposal: Proposal, company: CompanyContext, options: DesignOptions = {}): Design {
  const primaryMetric = objectiveMetrics[proposal.objective];
  const def = company.metrics[primaryMetric];
  const included = options.includedSegments ?? defaultSegments(proposal.objective);
  const dailyEligible = included.reduce((sum, segment) => sum + company.dailyTraffic[segment], 0);
  const weighted = (values: Record<SegmentId, number>) =>
    included.reduce((sum, segment) => sum + values[segment] * company.dailyTraffic[segment], 0) / dailyEligible;
  const pooled = weighted(def.baseline);
  const pooledSd = def.sd ? weighted(def.sd) : undefined;
  const variants = options.variants ?? [
    { id: "control" as const, name: "Current experience", description: "What every cook sees today.", weight: 0.5 },
    { id: "a" as const, name: proposal.title, description: proposal.treatment, weight: 0.5, diff: proposal.diff },
  ];

  let mde = options.mde ?? proposal.expectedLift;
  let perArm = samplesPerArm(def.kind, pooled, pooledSd, mde, 0.05, 0.8);
  let maxPerArm = Math.ceil(perArm * inflationFactor(LOOKS));
  const picked = options.allocation
    ? { share: options.allocation, days: wholeWeeks(maxPerArm, (dailyEligible * options.allocation) / variants.length) }
    : pickShare(maxPerArm, dailyEligible, variants.length);
  const allocation = picked.share;
  let durationDays = picked.days;
  let adjusted = false;
  if (durationDays > MAX_DAYS) {
    durationDays = MAX_DAYS;
    const perDayPerArm = (dailyEligible * allocation) / variants.length;
    mde *= Math.sqrt(maxPerArm / (perDayPerArm * MAX_DAYS));
    perArm = samplesPerArm(def.kind, pooled, pooledSd, mde, 0.05, 0.8);
    maxPerArm = Math.ceil(perArm * inflationFactor(LOOKS));
    adjusted = true;
  }

  const boundaries = obrienFlemingBoundaries(LOOKS, 0.05).map((efficacyZ, i) => ({
    look: i + 1,
    infoFraction: (i + 1) / LOOKS,
    efficacyZ,
    futilityCp: i === 0 ? null : 0.1,
  }));
  const lookDays = boundaries.map(({ infoFraction }) => Math.max(1, Math.round(durationDays * infoFraction)));
  const pct = (value: number) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
  const lookRule = boundaries.map((b) => `${b.efficacyZ.toFixed(2)} on day ${lookDays[b.look - 1]}`).join(", ");
  const trafficNote =
    allocation >= 1
      ? `All eligible traffic, because a smaller share would not finish in ${MAX_DAYS} days.`
      : `${pct(allocation)} of eligible traffic: the smallest share that finishes in ${TARGET_DAYS} days, so fewer cooks see an untested change.`;
  const significanceRule = [
    `Treatment wins if ${def.label} is higher than control and the z-score passes ${lookRule}.`,
    `That is O'Brien-Fleming alpha spending over ${LOOKS} looks, 5% false-positive rate overall, 80% power to detect a ${pct(mde)} change.`,
    adjusted ? `The smallest change it can detect was raised to ${pct(mde)} to fit ${MAX_DAYS} days.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    proposalId: proposal.id,
    objective: proposal.objective,
    primaryMetric,
    mde,
    alpha: 0.05,
    power: 0.8,
    perArm,
    maxPerArm,
    dailyEligible,
    allocation,
    trafficNote,
    durationDays,
    looks: LOOKS,
    lookDays,
    boundaries,
    significanceRule,
    guardrails: defaults[proposal.objective].map((g) => ({ ...g })),
    segments: ALL_SEGMENTS.map((segment) => segmentPlan(segment, included.includes(segment), primaryMetric)),
    variants,
    followUp: proposal.followUp,
  };
}
