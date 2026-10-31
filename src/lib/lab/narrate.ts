import type { CompanyContext, Design, GuardrailResult, LookResult, Update } from "./types.ts";

/** Plain-words messages the Analyst posts while an experiment runs. Days are relative to launch. */

const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)}%`;
const interval = (low: number, high: number) => `95% CI ${pct(low)} to ${pct(high)}`;

function at(day: number): string {
  return new Date(Date.UTC(2026, 10, day, 9)).toISOString();
}

export function launchUpdate(design: Design, company: CompanyContext): Update {
  const metric = company.metrics[design.primaryMetric].label;
  return {
    id: `${design.proposalId}-launch`,
    day: 0,
    at: at(0),
    agent: "analyst",
    kind: "milestone",
    title: "Live",
    body: `Watching ${metric} for ${(design.allocation * 100).toFixed(design.allocation < 0.1 ? 1 : 0)}% of eligible traffic. ${design.durationDays} days planned, first look on day ${design.lookDays[0]}. Guardrails are checked at every look.`,
  };
}

function guardrailNote(design: Design, company: CompanyContext, guardrails: GuardrailResult[]): string {
  const flagged = guardrails.filter((g) => g.status !== "ok");
  if (!flagged.length) return "All guardrails are within their margins.";
  return flagged
    .map((g) => {
      const plan = design.guardrails.find((item) => item.metric === g.metric);
      const label = company.metrics[g.metric].label;
      const margin = plan ? `${(plan.margin * 100).toFixed(1)}%` : "its margin";
      return g.status === "breached"
        ? `${label} is ${pct(g.lift)}, past the ${margin} it may lose.`
        : `${label} is ${pct(g.lift)}; watching it against the ${margin} margin.`;
    })
    .join(" ");
}

function stopBody(design: Design, look: LookResult, company: CompanyContext): string {
  const metric = company.metrics[design.primaryMetric].label;
  const saved = design.durationDays - look.day;
  const savedNote = saved > 0 ? ` That frees ${saved} days of traffic for the next test.` : "";
  if (look.crossed === "efficacy")
    return `${metric} ${pct(look.lift)} (${interval(look.ciLow, look.ciHigh)}). z = ${look.z.toFixed(2)}, past the ${look.boundaryZ.toFixed(2)} boundary set before launch. Stopping on day ${look.day} of ${design.durationDays}.${savedNote}`;
  if (look.crossed === "harm") {
    const breach = look.guardrails.find((g) => g.breached);
    const primary = `${metric} was ${pct(look.lift)}`;
    if (breach)
      return `Stopping now. ${guardrailNote(design, company, [breach])} ${primary}, but that is the trade this guardrail exists to block.${savedNote}`;
    return `Stopping now. ${metric} is ${pct(look.lift)} and moving the wrong way past the boundary.${savedNote}`;
  }
  return `${metric} ${pct(look.lift)} (${interval(look.ciLow, look.ciHigh)}). Even if the trend improved, the chance of a significant result by day ${design.durationDays} is under 10%, so Kismet stops for futility.${savedNote}`;
}

export function lookUpdate(design: Design, look: LookResult, company: CompanyContext): Update {
  const metric = company.metrics[design.primaryMetric].label;
  const title = `Look ${look.look} of ${design.looks}`;
  const base = {
    id: `${design.proposalId}-look-${look.look}`,
    day: look.day,
    at: at(look.day),
    agent: "analyst" as const,
  };
  if (look.srmP < 0.001)
    return {
      ...base,
      kind: "warning",
      title: `${title}: split is off`,
      body: `The arms are not the sizes they should be (p = ${look.srmP.toExponential(1)}). Holding the readout until the assignment is fixed.`,
    };
  if (look.crossed) {
    const label = { efficacy: "the result is in", harm: "stopped for harm", futility: "stopped, no effect" }[
      look.crossed
    ];
    return { ...base, kind: "decision", title: `${title}: ${label}`, body: stopBody(design, look, company) };
  }
  const watching = look.guardrails.some((g) => g.status !== "ok");
  const next = design.lookDays[look.look];
  return {
    ...base,
    kind: watching ? "warning" : "info",
    title,
    body: `${metric} ${pct(look.lift)} (${interval(look.ciLow, look.ciHigh)}). z = ${look.z.toFixed(2)}; it needs ${look.boundaryZ.toFixed(2)} to stop early here. ${guardrailNote(design, company, look.guardrails)}${next ? ` Next look on day ${next}.` : ""}`,
  };
}
