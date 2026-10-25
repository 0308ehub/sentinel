import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { describeMetric, parseMetricSpec } from "@/lib/autopilot/assign";
import { createExperiment, listExperiments, listSignals, log, setSignalStatus } from "@/lib/autopilot/store";
import type { Experiment, Signal } from "@/lib/autopilot/types";

/** After this many attempts on one problem, Autopilot stops and leaves it to a person. */
export const MAX_VERSIONS = 3;

const ACTIVE = new Set(["building", "awaiting_approval", "running", "awaiting_rollout"]);

function productContext(): string {
  return (
    process.env.AUTOPILOT_PRODUCT_CONTEXT?.trim() ||
    [
      "Kismet is a Next.js web app for product managers.",
      "Pages: /ai (chat), /autopilot, /dashboard, /explorer, /features (feature list), /features/[id], /board, /timeline, /graph,",
      "/analytics, /experiments, /decisions, /connectors, /settings, /settings/connectors/*.",
      "Creating a feature today happens through the ⌘K command palette item 'Propose feature…', which opens a dialog",
      "whose submit button is labelled 'Propose & open workspace'.",
    ].join(" ")
  );
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
}

interface DesignAnswer {
  title?: string;
  hypothesis?: string;
  control?: string;
  treatment?: string;
  metric?: unknown;
  guardrail?: string;
}

function attemptsSummary(previous: Experiment[]): string {
  if (previous.length === 0) return "No earlier attempts.";
  return previous
    .map((e) => {
      const r = e.readout;
      const result = r ? `${r.verdict}${r.lift != null ? `, lift ${(r.lift * 100).toFixed(1)}%` : ""}` : e.status;
      return `v${e.version}: ${e.treatment} → ${result}${e.note ? ` (${e.note})` : ""}`;
    })
    .join("\n");
}

/** Turns the strongest ready problem into an experiment brief. One per run keeps cost and noise down. */
export async function designNext(): Promise<string | null> {
  const [signals, experiments] = await Promise.all([listSignals(), listExperiments()]);
  // One change in the build pipeline at a time, so a blocked build doesn't pile up drafts.
  if (experiments.some((e) => e.status === "building")) return null;
  const busy = new Set(experiments.filter((e) => ACTIVE.has(e.status)).map((e) => e.signalId));
  const candidate: Signal | undefined = signals.find((s) => s.ready && s.status === "open" && !busy.has(s.id));
  if (!candidate) return null;

  const previous = experiments.filter((e) => e.signalId === candidate.id).sort((a, b) => a.version - b.version);
  if (previous.length >= MAX_VERSIONS) {
    await setSignalStatus(candidate.id, "dismissed");
    await log("design", `Stopped working on “${candidate.title}” after ${MAX_VERSIONS} attempts. It needs a person.`, candidate.id);
    return null;
  }

  const text = await askForJson(
    [
      "You are an autonomous product manager. Design one small, shippable A/B experiment that addresses the problem.",
      "The change must be a UI change to one existing React component, safe to show to half of visitors.",
      "Pick the metric as the outcome the user is trying to reach, which must be possible in BOTH versions,",
      "never the new element itself (clicks on a button only the new version has would rig the test).",
      "Use one of:",
      '{"kind":"click","text":"<visible label of the button or link that completes the task in both versions, e.g. the submit button of a dialog>"}',
      'or {"kind":"visit","path":"/some/path"} (visitor reaches that page in either version).',
      "Return JSON: {title, hypothesis, control, treatment, metric, guardrail}. Keep each field to one or two sentences.",
      "If earlier attempts failed or were rejected, try a meaningfully different idea.",
    ].join(" "),
    [
      `PRODUCT\n${productContext()}`,
      `PROBLEM\n${candidate.title}: ${candidate.problem} (area: ${candidate.area || "unknown"})`,
      `EVIDENCE (${candidate.evidence.length})`,
      ...candidate.evidence.slice(0, 15).map((e) => `- [${e.source}] ${e.title}${e.body && e.source !== "slack" ? ` — ${e.body}` : ""}`),
      `EARLIER ATTEMPTS\n${attemptsSummary(previous)}`,
    ].join("\n"),
    false,
    undefined,
    "experiment"
  );

  const answer = readJson<DesignAnswer>(text);
  const spec = parseMetricSpec(answer.metric);
  if (!answer.title || !answer.treatment || !spec) throw new Error("The experiment design was missing a title, change or metric.");

  const version = previous.length + 1;
  const flag = `ap-${slug(answer.title)}-v${version}`;
  await createExperiment({
    signalId: candidate.id,
    version,
    title: answer.title,
    hypothesis: answer.hypothesis ?? "",
    metric: describeMetric(spec),
    metricSpec: spec,
    guardrail: answer.guardrail ?? "",
    control: answer.control ?? "",
    treatment: answer.treatment,
    flag,
  });
  await setSignalStatus(candidate.id, "experimenting");
  await log("design", `Designed “${answer.title}” for “${candidate.title}”.`, candidate.id);
  return `Designed an experiment for “${candidate.title}”.`;
}
