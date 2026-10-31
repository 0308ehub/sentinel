import { interactionZ } from "./stats.ts";
import type { CompanyContext, Design, LookResult, MetricId, Readout, SegmentId, StopReason } from "./types.ts";

const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)}%`;
const SEGMENT_LABEL: Record<SegmentId, string> = {
  new: "new cooks",
  casual: "casual cooks",
  power: "power cooks",
  premium: "Premium cooks",
};

function isHeterogeneous(segments: LookResult["segments"]): boolean {
  return segments.some((a, i) => segments.slice(i + 1).some((b) => Math.abs(interactionZ(a, b)) > 1.96));
}

function decideRecommendation(
  design: Design,
  look: LookResult,
  stopReason: StopReason,
): { recommendation: Readout["recommendation"]; unclear: MetricId | null } {
  const stopBreach = look.guardrails.find((g, i) => g.breached && design.guardrails[i]?.action === "stop");
  if (stopReason === "harm" || stopBreach)
    return { recommendation: "kill" as const, unclear: stopBreach?.metric ?? null };
  if (stopReason !== "efficacy") return { recommendation: "iterate" as const, unclear: null };
  // A primary win only ships when every guardrail has cleared its margin.
  const unclear = look.guardrails.find((g) => g.status !== "ok");
  if (unclear) return { recommendation: "iterate" as const, unclear: unclear.metric };
  const positive = look.segments.filter((s) => s.ciLow > 0);
  if (isHeterogeneous(look.segments) && positive.length)
    return { recommendation: "ship_segment" as const, unclear: null };
  return { recommendation: "ship_all" as const, unclear: null };
}

export function buildReadout(
  design: Design,
  lastLook: LookResult,
  stopReason: StopReason,
  company: CompanyContext,
): Readout {
  const metrics = company.metrics;
  const primaryLabel = metrics[design.primaryMetric].label;
  const { recommendation, unclear } = decideRecommendation(design, lastLook, stopReason);
  const included = design.segments.filter((s) => s.included).map((s) => s.segment);
  const positive = lastLook.segments.filter((s) => s.ciLow > 0).map((s) => s.segment);
  const shipSegments = recommendation === "ship_segment" ? positive : recommendation === "ship_all" ? included : [];
  const winner = recommendation === "ship_all" || recommendation === "ship_segment" ? "a" : null;
  const daysSaved = Math.max(0, design.durationDays - lastLook.day);
  const breach = lastLook.guardrails.find((g) => g.status !== "ok");

  const headline = {
    ship_all: `Ship it: ${primaryLabel} ${pct(lastLook.lift)} for everyone in the test`,
    ship_segment: `Ship it to ${shipSegments.map((s) => SEGMENT_LABEL[s]).join(" and ")}: that is where it works`,
    kill: breach
      ? `Stopped: ${metrics[breach.metric].label} fell ${pct(breach.lift).replace(/^[+−]/, "")}, past its guardrail`
      : `Stopped: ${primaryLabel} moved the wrong way`,
    iterate: unclear
      ? `${primaryLabel} improved, but ${metrics[unclear].label} has not cleared its guardrail`
      : `No real effect on ${primaryLabel}`,
  }[recommendation];

  const segmentLines = lastLook.segments.map(
    (s) =>
      `${SEGMENT_LABEL[s.segment]}: ${metrics[s.metric].label} ${pct(s.lift)} (95% CI ${pct(s.ciLow)} to ${pct(s.ciHigh)})`,
  );
  const guardrailLines = lastLook.guardrails.map(
    (g) =>
      `${metrics[g.metric].label} ${pct(g.lift)}: ${g.status === "ok" ? "within its margin" : g.status === "watch" ? "not yet cleared" : "breached"}`,
  );
  const stopLine =
    daysSaved > 0
      ? `Stopped at look ${lastLook.look} on day ${lastLook.day} of ${design.durationDays}, ${daysSaved} days early.`
      : `Ran the full ${design.durationDays} days.`;

  return {
    winner,
    recommendation,
    shipSegments,
    headline,
    summary: [
      `${primaryLabel} ${pct(lastLook.lift)} overall (95% CI ${pct(lastLook.ciLow)} to ${pct(lastLook.ciHigh)}), z = ${lastLook.z.toFixed(2)} against a boundary of ${lastLook.boundaryZ.toFixed(2)}.`,
      stopLine,
      ...guardrailLines,
    ],
    primary: { lift: lastLook.lift, ciLow: lastLook.ciLow, ciHigh: lastLook.ciHigh, pValue: lastLook.pValue },
    guardrails: lastLook.guardrails,
    segments: lastLook.segments,
    daysSaved,
    learnings: [
      ...segmentLines,
      recommendation === "ship_segment"
        ? `The effect differs by segment, so shipping to everyone would dilute it. Kismet ships only where the interval is above zero.`
        : "",
    ].filter(Boolean),
    nextIdea: design.followUp ?? `Try a different approach to ${primaryLabel.toLowerCase()}.`,
  };
}

export interface ShipDiff {
  file: string;
  before: string;
  after: string;
  title: string;
  checks: string[];
}

/** The change that removes the experiment flag: the winner stays, for everyone or only for the segments it helped. */
export function buildShipDiff(design: Design, readout: Readout): ShipDiff {
  const diff = design.variants.find((v) => v.id === "a")?.diff;
  const flagged = `flag("${design.proposalId}") === "a"`;
  const segments = readout.shipSegments;
  const forSegments = readout.recommendation === "ship_segment";
  const who = forSegments ? ` for ${segments.map((s) => SEGMENT_LABEL[s]).join(" and ")}` : "";
  const condition = `cook.segment === ${segments.map((s) => `"${s}"`).join(" || cook.segment === ")}`;
  const before = diff?.after ?? `if (${flagged}) return <Treatment />;`;
  const after = forSegments
    ? before.replace(flagged, condition)
    : (diff?.shipped ?? before.replace(`${flagged} && `, ""));
  return {
    file: diff?.file ?? "src/lib/flags.ts",
    before,
    after,
    title: `Keep the winner${who} and remove the ${design.proposalId} flag`,
    checks: [
      `Flag ${design.proposalId} removed and archived`,
      forSegments ? `Winner on only${who}; everyone else keeps today's version` : "Winner on for every cook",
      "Typecheck and tests pass",
      "Guardrail metrics stay on the dashboard for 14 days",
    ],
  };
}
