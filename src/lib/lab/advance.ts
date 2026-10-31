import { PANTRY, SCENARIOS, followUpFor } from "./company.ts";
import { buildReadout, buildShipDiff, type ShipDiff } from "./readout.ts";
import { runExperiment, type RunResult } from "./monitor.ts";
import type { Design, ExperimentStage, Proposal, Readout, ScenarioTruth, StopReason, Update } from "./types.ts";

export type LabRun = RunResult;
export interface LabExperiment {
  id: string;
  proposal: Proposal;
  design: Design | null;
  stage: ExperimentStage;
  launchedDay: number | null;
  stopDay: number | null;
  stopReason: StopReason | null;
  seed: number;
  truthKey: string | null;
  truth?: ScenarioTruth;
  run: LabRun | null;
  readout: Readout | null;
  ship: {
    status: "draft" | "awaiting" | "merged" | "changes_requested";
    diff: ShipDiff;
    note?: string;
  } | null;
  updates: Update[];
  queuedBehind: string | null;
}
export interface AdvanceState {
  clock: { day: number; playing: boolean; speed: 1 | 4 | 16 };
  experiments: LabExperiment[];
  feed: Update[];
}

/** Experiment day 1 is the launch day, so experiment day k happens on clock day launchedDay + k - 1. */
const toClockDay = (experimentDay: number, launchedDay: number) => launchedDay + Math.max(0, experimentDay - 1);
const clockDate = (day: number, hour = 9) => new Date(Date.UTC(2026, 10, day, hour)).toISOString();

const globalUpdate = (update: Update, launchedDay: number): Update => {
  const day = toClockDay(update.day, launchedDay);
  return { ...update, day, at: clockDate(day) };
};

function truthFor(experiment: LabExperiment): ScenarioTruth {
  if (experiment.truth) return experiment.truth;
  if (experiment.truthKey) return SCENARIOS[experiment.truthKey]?.truth ?? {};
  return {};
}

export function materializeRun(experiment: LabExperiment): LabRun | null {
  if (!experiment.design) return null;
  return experiment.run ?? runExperiment(experiment.design, truthFor(experiment), experiment.seed, PANTRY);
}

function post(feed: Update[], updates: Update[]): Update[] {
  const ids = new Set(feed.map((item) => item.id));
  return [...updates.filter((item) => !ids.has(item.id)).reverse(), ...feed].slice(0, 200);
}

export function advance(state: AdvanceState, toDay: number): AdvanceState {
  const day = Math.max(state.clock.day, Math.floor(toDay));
  let feed = state.feed;
  let experiments = state.experiments.map((experiment) => {
    if (experiment.stage !== "running" || experiment.launchedDay === null || !experiment.design) return experiment;
    const run = materializeRun(experiment)!;
    const elapsed = day - experiment.launchedDay + 1;
    const revealed = run.updates
      .filter((update) => update.day <= elapsed)
      .map((update) => globalUpdate(update, experiment.launchedDay!));
    feed = post(feed, revealed);
    let next: LabExperiment = { ...experiment, run, updates: revealed };
    if (elapsed < run.stopDay) return next;
    const lastLook = run.looks.at(-1);
    if (!lastLook) return next;
    const readout = buildReadout(experiment.design, lastLook, run.stopReason, PANTRY);
    const ship =
      readout.recommendation === "ship_all" || readout.recommendation === "ship_segment"
        ? { status: "awaiting" as const, diff: buildShipDiff(experiment.design, readout) }
        : null;
    const decision: Update = {
      id: `${experiment.id}-readout`,
      day: toClockDay(run.stopDay, experiment.launchedDay),
      at: clockDate(toClockDay(run.stopDay, experiment.launchedDay), 10),
      agent: "shipper",
      kind: "decision",
      title: ship ? "Ready for review" : "Readout filed",
      body: readout.headline,
    };
    feed = post(feed, [decision]);
    next = {
      ...next,
      stage: ship ? "shipping" : "decided",
      stopDay: toClockDay(run.stopDay, experiment.launchedDay),
      stopReason: run.stopReason,
      readout,
      ship,
      updates: [...revealed, decision],
    };
    return next;
  });

  // Scout turns every decided result into the next proposal, built on what was learned.
  for (const experiment of [...experiments]) {
    if (!experiment.readout || experiment.proposal.id.endsWith("-next")) continue;
    const next = followUpFor(experiment.proposal);
    if (!next || experiments.some((item) => item.id === next.proposal.id)) continue;
    const update: Update = {
      id: `${next.proposal.id}-proposed`,
      day,
      at: clockDate(day, 11),
      agent: "scout",
      kind: "milestone",
      title: "Next test proposed",
      body: `${next.proposal.title}. ${next.proposal.hypothesis}`,
    };
    experiments.push({
      id: next.proposal.id,
      proposal: next.proposal,
      design: null,
      stage: "proposed",
      launchedDay: null,
      stopDay: null,
      stopReason: null,
      seed: experiment.seed + 97,
      truthKey: null,
      truth: next.truth,
      run: null,
      readout: null,
      ship: null,
      updates: [update],
      queuedBehind: null,
    });
    feed = post(feed, [update]);
  }

  // A queued experiment starts as soon as every conflicting blocker has stopped.
  experiments = experiments.map((experiment) => {
    if (experiment.stage !== "queued" || !experiment.queuedBehind) return experiment;
    const blocker = experiments.find((item) => item.id === experiment.queuedBehind);
    if (blocker && ["running", "queued"].includes(blocker.stage)) return experiment;
    const update: Update = {
      id: `${experiment.id}-queue-start`,
      day,
      at: clockDate(day),
      agent: "analyst",
      kind: "milestone",
      title: "Queue cleared",
      body: `${blocker?.proposal.title ?? "The blocking test"} ended. Starting this test now.`,
    };
    feed = post(feed, [update]);
    return {
      ...experiment,
      stage: "running",
      launchedDay: day,
      queuedBehind: null,
      updates: [update],
      run: materializeRun(experiment),
    };
  });
  return { ...state, clock: { ...state.clock, day }, experiments, feed };
}
