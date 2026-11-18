import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { describeMetric, parseMetricSpec } from "@/lib/autopilot/assign";
import { relevantLearnings } from "@/lib/autopilot/learning-core";
import { createExperiment, interviewContext, listExperiments, listGoals, listLearnings, listRatings, listSignals, log, metricBaseline, recentJourneys, setSignalStatus, snoozeSignal } from "@/lib/autopilot/store";
import { daysToResult, type ResultEstimate } from "@/lib/autopilot/power";
import { maxExperimentDays, relativeMde } from "@/lib/autopilot/thresholds";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { buildThemes } from "@/lib/autopilot/themes";
import { formatPreferences } from "@/lib/autopilot/preferences";

/** After this many attempts on one problem, Autopilot stops and leaves it to a person. */
export const MAX_VERSIONS = 3;

const ACTIVE = new Set(["building", "awaiting_approval", "queued", "running", "awaiting_rollout"]);

async function productContext(): Promise<string> {
  const base = (
    process.env.AUTOPILOT_PRODUCT_CONTEXT?.trim() ||
    [
      "Kismet is a Next.js web app for product managers.",
      "Pages: /ai (chat), /experiments, /dashboard, /explorer, /features (feature list), /features/[id], /board, /timeline, /graph,",
      "/analytics, /decisions, /integrations, /settings, /settings/connectors/*.",
      "The live /experiments page is a table: name, type, feature, environments, modified, created, and a Results button.",
      "A black Create New Experiment button runs Kismet's loop. Suggested rows are grey, marked Suggested, until a person approves them.",
      "Opening a running experiment shows variations, conversions per visitor, improvement, a confidence interval, and visitors over time.",
      "Design a change to controls that are on the page today, or add one new control. Do not make a missing button more prominent.",
      "Creating a feature happens through the command palette item Propose feature…, whose submit button is Propose & open workspace.",
    ].join(" ")
  );
  const context = await interviewContext();
  return context.length ? `${base}\n\nWHAT THIS ACCOUNT TOLD KISMET\n${context.map((e) => `${e.title}: ${e.body}`).join("\n")}` : base;
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
  page?: string;
  guardrail?: string;
  guardrailMetric?: unknown;
}

interface ChangeAnswer extends DesignAnswer {
  reasoning?: string;
  evidence?: Array<{ source?: string; quote?: string }>;
  confidence?: "high" | "medium" | "low";
  confidenceReason?: string;
  risks?: string;
  question?: string;
}

async function designFix(candidate: Signal, experiments: Experiment[]): Promise<string> {
  const previous = experiments.filter((experiment) => experiment.signalId === candidate.id);
  const version = previous.length + 1;
  const system = [
    "You are fixing a reported bug. Explain what is most likely broken given the evidence, the fix, and what could go wrong.",
    "Do not propose experiments, flags, variants, or A/B tests.",
    "Return JSON: {title,hypothesis,control,treatment,page,reasoning,evidence:[{source,quote}],confidence,confidenceReason,risks}.",
    "title is a short description without a Fix prefix. hypothesis says what is broken. treatment is the intended fix in one or two sentences.",
    "confidence must be high or medium. Cite 2–6 complaints when available.",
  ].join(" ");
  const user = JSON.stringify({
    problem: { title: candidate.title, description: candidate.problem, area: candidate.area },
    complaints: candidate.evidence.slice(0, 15).map((item) => ({ source: item.source, author: item.author, title: item.title, body: item.body })),
  });
  const answer = readJson<ChangeAnswer>(await askForJson(system, user, false, undefined, "experiment"));
  const cited = (answer.evidence ?? []).filter((item) => item.source?.trim() && item.quote?.trim()).slice(0, 6);
  if (!answer.title?.trim() || !answer.treatment?.trim() || !answer.reasoning?.trim() || !answer.confidence || answer.confidence === "low" || !cited.length) {
    throw new Error("The fix design was missing a title, fix, reasoning, confidence, or complaint.");
  }
  const shortTitle = answer.title.trim().replace(/^fix:\s*/i, "");
  await createExperiment({
    signalId: candidate.id,
    version,
    kind: "fix",
    title: `Fix: ${shortTitle}`,
    hypothesis: answer.hypothesis?.trim() || candidate.problem,
    metric: "",
    metricSpec: null,
    page: answer.page?.trim().startsWith("/") ? answer.page.trim() : candidate.area,
    guardrail: "",
    control: answer.control?.trim() || candidate.problem,
    treatment: answer.treatment.trim(),
    flag: `fix-${slug(shortTitle)}-v${version}`,
    estimate: null,
    rationale: {
      reasoning: answer.reasoning.trim(),
      evidence: cited.map((item) => ({ source: item.source!.trim(), quote: item.quote!.trim() })),
      confidence: answer.confidence,
      confidenceReason: answer.confidenceReason?.trim() ?? "",
      risks: answer.risks?.trim() ?? "",
    },
  });
  await setSignalStatus(candidate.id, "experimenting");
  await log("design", `Proposed a fix “${shortTitle}” for “${candidate.title}”.`, candidate.id);
  return `Proposed a fix for “${candidate.title}”.`;
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

/** Designs one experiment for a problem. Returns null once the problem has used its attempts. */
/**
 * personApproved: a person asked for this test. Kismet still tries once to make it conclude faster,
 * but builds it anyway with its estimate instead of snoozing it.
 */
async function designCandidate(candidate: Signal, experiments: Experiment[], personApproved = false): Promise<string | null> {
  if (candidate.kind === "bug") return designFix(candidate, experiments);
  const previous = experiments.filter((e) => e.signalId === candidate.id).sort((a, b) => a.version - b.version);
  if (previous.length >= MAX_VERSIONS) {
    await setSignalStatus(candidate.id, "dismissed");
    await log("design", `Stopped working on “${candidate.title}” after ${MAX_VERSIONS} attempts. It needs a person.`, candidate.id);
    return null;
  }

  const [goals, allLearnings, ratings] = await Promise.all([listGoals(), listLearnings(200), listRatings()]);
  const candidatePage = previous.findLast((experiment) => experiment.page)?.page ?? candidate.area;
  const usefulLearnings = relevantLearnings(allLearnings, { page: candidatePage, area: candidate.area });
  const earlierLearnings = allLearnings.filter((learning) => learning.signalId === candidate.id);
  const goalsText = goals.length ? goals.map((g) => `- ${g.name}: ${describeMetric(g.spec)} (${(g.baselineRate * 100).toFixed(1)}%, ${Math.round(g.weeklyVisitors)} visitors/week)`).join("\n") : "No goals yet.";
  const theme = buildThemes([candidate], new Date())[0];
  const themeText = theme
    ? `${theme.people} people mentioned this ${theme.mentions} times (${theme.trend})${theme.quotes.length ? `\n${theme.quotes.map((quote) => `- “${quote.text}” — ${quote.source}${quote.author ? ` · ${quote.author}` : ""}`).join("\n")}` : ""}`
    : "No qualitative theme for this problem.";
  const system = [
      "You are an autonomous product manager. Design one small, shippable A/B experiment that addresses the problem.",
      "The change must be a UI change to one existing React component, safe to show to half of visitors.",
      "Pick the metric as the outcome the user is trying to reach, which must be possible in BOTH versions,",
      "never the new element itself (clicks on a button only the new version has would rig the test).",
      "Use one of:",
      '{"kind":"click","text":"<visible label of the button or link that completes the task in both versions, e.g. the submit button of a dialog>"}',
      'or {"kind":"visit","path":"/some/path"} (visitor reaches that page in either version).',
      "page is the route the change appears on, like /features or /settings/connectors.",
      "Optionally choose a guardrail outcome that must not get worse, using the same metric format; omit guardrailMetric if none fits.",
      "Return JSON: {title, hypothesis, control, treatment, metric, page, guardrail, guardrailMetric}. Keep each text field to one or two sentences.",
      "If earlier attempts failed or were rejected, try a meaningfully different idea.",
      "Build on LEARNINGS: repeat what won in new places, do not retry ideas that lost, were flat, or that a person rejected, unless you change them meaningfully and say how.",
      "Prefer one of the GOALS as the metric when the change can plausibly move it; otherwise use the closest outcome both versions share.",
    ].join(" ");
  const user = [
      `PRODUCT\n${await productContext()}`,
      `GOALS\n${goalsText}`,
      `PROBLEM\n${candidate.title}: ${candidate.problem} (area: ${candidate.area || "unknown"})`,
      `THEMES\n${themeText}`,
      `EVIDENCE (${candidate.evidence.length})`,
      ...candidate.evidence.slice(0, 15).map((e) => `- [${e.source}] ${e.title}${e.body && e.source !== "slack" ? ` — ${e.body}` : ""}`),
      `LEARNINGS\n${usefulLearnings.length ? usefulLearnings.map((learning) => `- ${learning.outcome}: ${learning.title} — ${learning.learning}`).join("\n") : "No relevant learnings yet."}`,
      `EARLIER ATTEMPTS\n${attemptsSummary(previous)}${earlierLearnings.length ? `\nLearnings from this signal:\n${earlierLearnings.map((learning) => `- ${learning.outcome}: ${learning.learning}`).join("\n")}` : ""}`,
      `PREFERENCES\n${formatPreferences(ratings)}`,
    ].join("\n");
  async function request(message: string): Promise<{ answer: DesignAnswer; spec: NonNullable<ReturnType<typeof parseMetricSpec>>; estimate: ResultEstimate }> {
    const text = await askForJson(system, message, false, undefined, "experiment");
    const answer = readJson<DesignAnswer>(text);
    const spec = parseMetricSpec(answer.metric);
    if (!answer.title || !answer.treatment || !spec) throw new Error("The experiment design was missing a title, change or metric.");
    const baseline = await metricBaseline(spec);
    const baselineRate = baseline.visitors ? baseline.conversions / baseline.visitors : 0;
    const relative = relativeMde();
    const result = daysToResult({ weeklyVisitors: baseline.weeklyVisitors, baselineRate, relativeMde: relative });
    return { answer, spec, estimate: { baselineRate, weeklyVisitors: baseline.weeklyVisitors, relativeMde: relative, ...result, at: new Date().toISOString() } };
  }
  let proposed = await request(user);
  const maxDays = maxExperimentDays();
  if (proposed.estimate.days > maxDays) {
    const days = Number.isFinite(proposed.estimate.days) ? proposed.estimate.days : "infinite";
    const feedback = `That test would need about ${days} days (${Math.round(proposed.estimate.weeklyVisitors)} visitors/week, ${(proposed.estimate.baselineRate * 100).toFixed(1)}% currently do ${describeMetric(proposed.spec)}). Redesign so it can conclude within ${maxDays} days: use a more common outcome (see GOALS and their baselines), a busier page, or a bolder change.`;
    proposed = await request(`${user}\n\nFEEDBACK\n${feedback}`);
  }
  const { answer, spec, estimate } = proposed;
  const guardrailSpec = parseMetricSpec(answer.guardrailMetric);
  if (!answer.title || !answer.treatment || !spec) throw new Error("The experiment design was missing a title, change or metric.");
  if (estimate.days > maxDays && !personApproved) {
    const journeys = await recentJourneys();
    const changeSystem = [
      "You are an autonomous product manager working in evidence-backed change mode.",
      "There is not enough traffic for an A/B test. Propose one small, reversible UI change that the evidence strongly supports.",
      "Cite the specific evidence and journeys that support it with 2–6 evidence items.",
      "Judge confidence honestly: high = several independent pieces of evidence point the same way and the fix follows directly; medium = solid but indirect; low = speculative.",
      "Say what could go wrong. Optionally draft one short question to ask users that would most reduce the uncertainty.",
      "metric is the outcome to check before and after the change (prefer one of the GOALS). It must be exactly one of:",
      '{"kind":"click","text":"<visible label of a button or link that exists before and after the change>"}',
      'or {"kind":"visit","path":"/some/path"}. page is the route the change appears on, like /settings/connectors.',
      'Return JSON: {title, hypothesis, control, treatment, metric, page, guardrail, reasoning, evidence:[{source, quote}], confidence, confidenceReason, risks, question}.',
    ].join(" ");
    const changeText = await askForJson(changeSystem, `${user}\n\nJOURNEYS\n${journeys.length ? journeys.join("\n") : "No recent journeys."}`, false, undefined, "experiment");
    const change = readJson<ChangeAnswer>(changeText);
    const changeSpec = parseMetricSpec(change.metric);
    const cited = (change.evidence ?? []).filter((item) => item.source?.trim() && item.quote?.trim()).slice(0, 6);
    if (!change.title || !change.treatment || !changeSpec) throw new Error("The evidence-backed change was missing a title, change or metric.");
    if (change.confidence === "low" || cited.length === 0 || !change.confidence) {
      await snoozeSignal(candidate.id);
      const message = `Not enough evidence to change anything for “${candidate.title}” yet; Kismet will look again next week.`;
      await log("design", message, candidate.id);
      return message;
    }
    const baseline = await metricBaseline(changeSpec);
    const baselineRate = baseline.visitors ? baseline.conversions / baseline.visitors : 0;
    const relative = relativeMde();
    const result = daysToResult({ weeklyVisitors: baseline.weeklyVisitors, baselineRate, relativeMde: relative });
    proposed = { answer: change, spec: changeSpec, estimate: { baselineRate, weeklyVisitors: baseline.weeklyVisitors, relativeMde: relative, ...result, at: new Date().toISOString() } };
    const version = previous.length + 1;
    await createExperiment({
      signalId: candidate.id, version, kind: "change", title: change.title, hypothesis: change.hypothesis ?? "",
      metric: describeMetric(changeSpec), metricSpec: changeSpec,
      page: change.page?.trim().startsWith("/") ? change.page.trim() : candidate.area,
      guardrail: change.guardrail ?? "", control: change.control ?? "", treatment: change.treatment,
      flag: `ap-${slug(change.title)}-v${version}`, estimate: proposed.estimate,
      rationale: {
        reasoning: change.reasoning?.trim() ?? "", evidence: cited.map((item) => ({ source: item.source!.trim(), quote: item.quote!.trim() })),
        confidence: change.confidence, confidenceReason: change.confidenceReason?.trim() ?? "", risks: change.risks?.trim() ?? "",
        ...(change.question?.trim() ? { question: change.question.trim() } : {}),
      },
    });
    await setSignalStatus(candidate.id, "experimenting");
    await log("design", `Proposed a change “${change.title}” for “${candidate.title}”.`, candidate.id);
    return `Proposed a change for “${candidate.title}”.`;
  }

  const version = previous.length + 1;
  const flag = `ap-${slug(answer.title)}-v${version}`;
  await createExperiment({
    signalId: candidate.id,
    version,
    title: answer.title,
    hypothesis: answer.hypothesis ?? "",
    metric: describeMetric(spec),
    metricSpec: spec,
    page: answer.page?.trim().startsWith("/") ? answer.page.trim() : candidate.area,
    guardrail: answer.guardrail ?? (guardrailSpec ? describeMetric(guardrailSpec) : ""),
    guardrailSpec,
    control: answer.control ?? "",
    treatment: answer.treatment,
    flag,
    estimate,
  });
  await setSignalStatus(candidate.id, "experimenting");
  await log("design", `Designed “${answer.title}” for “${candidate.title}”.`, candidate.id);
  return `Designed an experiment for “${candidate.title}”.`;
}

/** Turns the strongest ready problem into an experiment brief. One per run keeps cost and noise down. */
export async function designNext(): Promise<string | null> {
  const [signals, experiments, ratings] = await Promise.all([listSignals(), listExperiments(), listRatings()]);
  // One change in the build pipeline at a time, so a blocked build doesn't pile up drafts.
  if (experiments.some((e) => e.status === "building")) return null;
  const busy = new Set(experiments.filter((e) => ACTIVE.has(e.status)).map((e) => e.signalId));
  const now = Date.now();
  const liked = new Set(ratings.filter((rating) => rating.targetKind === "signal" && rating.rating === "good").map((rating) => rating.targetId));
  const candidates = signals.filter((s) => s.ready && s.status === "open" && (!s.snoozedUntil || Date.parse(s.snoozedUntil) <= now) && !busy.has(s.id));
  const candidate = candidates.find((signal) => liked.has(signal.id)) ?? candidates[0];
  if (!candidate) return null;
  return designCandidate(candidate, experiments);
}

/** Starts a test for one problem the person chose, including one that is still short of the evidence bar. */
export async function designSignal(signalId: string): Promise<string> {
  const [signals, experiments] = await Promise.all([listSignals(), listExperiments()]);
  const candidate = signals.find((s) => s.id === signalId);
  if (!candidate || candidate.status === "dismissed" || candidate.status === "stale") throw new Error("That problem is not available.");
  if (experiments.some((e) => e.status === "building")) {
    throw new Error("Kismet is already building a change. This one starts when that build finishes.");
  }
  if (experiments.some((e) => e.signalId === candidate.id && ACTIVE.has(e.status))) {
    throw new Error("Kismet is already testing this problem.");
  }
  const message = await designCandidate(candidate, experiments, true);
  if (!message) throw new Error(`“${candidate.title}” needs a person after ${MAX_VERSIONS} attempts.`);
  return message;
}
