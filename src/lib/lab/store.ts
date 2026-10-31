"use client";

import { useEffect, useSyncExternalStore } from "react";
import { advance, materializeRun, type AdvanceState, type LabExperiment } from "./advance";
import { PANTRY, SCENARIOS, SKIPPED } from "./company";
import { designExperiment } from "./design";
import type { Objective, Proposal, ScenarioTruth, Update } from "./types";

export interface LabState extends AdvanceState {
  discovery: { status: "idle" | "reading" | "done"; step: number };
  autonomy: "ask" | "auto";
  customError: string | null;
}
const KEY = "kismet-lab";
const VERSION = 3;
const EMPTY: LabState = {
  clock: { day: 1, playing: false, speed: 4 },
  discovery: { status: "idle", step: 0 },
  experiments: [],
  autonomy: "ask",
  feed: [],
  customError: null,
};
let snapshot = EMPTY;
let hydrated = false;
let interval: ReturnType<typeof setInterval> | null = null;
let discoveryTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (next: LabState) => {
  snapshot = next;
  listeners.forEach((fn) => fn());
};
const update = (fn: (state: LabState) => LabState) => {
  hydrate();
  write(fn(snapshot));
};

function scenarioKey(id: string): string | null {
  return Object.entries(SCENARIOS).find(([, scenario]) => scenario.proposal.id === id)?.[0] ?? null;
}
function read(): LabState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as { version?: number; state?: LabState } | null;
    if (parsed?.version !== VERSION || !parsed.state || !Array.isArray(parsed.state.experiments)) return EMPTY;
    return {
      ...parsed.state,
      clock: { ...parsed.state.clock, playing: false },
      experiments: parsed.state.experiments.map((e) => ({ ...e, run: materializeRun({ ...e, run: null }) })),
    };
  } catch {
    return EMPTY;
  }
}
function hydrate() {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    emit(read());
    syncClock();
  }
}
function write(next: LabState) {
  snapshot = next;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: VERSION, state: next }, (key, value) =>
        key === "run" || key === "truth" ? undefined : value,
      ),
    );
  } catch {
    /* session state remains usable */
  }
  listeners.forEach((fn) => fn());
  syncClock();
}
function syncClock() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (!snapshot.clock.playing || typeof window === "undefined") return;
  interval = setInterval(
    () =>
      update((state) => ({
        ...advance(state, state.clock.day + 1),
        discovery: state.discovery,
        autonomy: state.autonomy,
        customError: state.customError,
      })),
    2000 / snapshot.clock.speed,
  );
}
export function useLabStore(): LabState {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
  useEffect(hydrate, []);
  return state;
}
export function startLabClock() {
  hydrate();
  syncClock();
  return () => {
    if (interval) clearInterval(interval);
    interval = null;
  };
}
export function playLab() {
  update((s) => ({ ...s, clock: { ...s.clock, playing: true } }));
}
export function pauseLab() {
  update((s) => ({ ...s, clock: { ...s.clock, playing: false } }));
}
export function setLabSpeed(speed: 1 | 4 | 16) {
  update((s) => ({ ...s, clock: { ...s.clock, speed } }));
}
export function skipToNextEvent() {
  update((s) => {
    const days = s.experiments.flatMap((e) =>
      e.stage === "running" && e.launchedDay !== null && e.design
        ? (materializeRun(e)?.updates ?? [])
            .map((u) => e.launchedDay! + Math.max(0, u.day - 1))
            .filter((d) => d > s.clock.day)
        : [],
    );
    return days.length
      ? { ...advance(s, Math.min(...days)), discovery: s.discovery, autonomy: s.autonomy, customError: s.customError }
      : s;
  });
}
const scoutUpdate = (day: number): Update => ({
  id: `discovery-${day}`,
  day,
  at: new Date().toISOString(),
  agent: "scout",
  kind: "milestone",
  title: "Four tests worth designing",
  body: "Ranked the ideas against Pantry’s goals, behavior, code, and past results.",
});
export function runDiscovery() {
  if (discoveryTimer) clearInterval(discoveryTimer);
  update((s) => ({ ...s, discovery: { status: "reading", step: 0 }, experiments: [] }));
  discoveryTimer = setInterval(
    () =>
      update((s) => {
        const step = s.discovery.step + 1;
        if (step < 6) return { ...s, discovery: { status: "reading", step } };
        if (discoveryTimer) clearInterval(discoveryTimer);
        discoveryTimer = null;
        const proposals = [...Object.values(SCENARIOS).map((scenario) => scenario.proposal), ...SKIPPED];
        const experiments = proposals.map(
          (proposal): LabExperiment => ({
            id: proposal.id,
            proposal,
            design: null,
            stage: proposal.skippedReason ? "rejected" : "proposed",
            launchedDay: null,
            stopDay: null,
            stopReason: null,
            seed: 18,
            truthKey: scenarioKey(proposal.id),
            run: null,
            readout: null,
            ship: null,
            updates: [],
            queuedBehind: null,
          }),
        );
        const item = scoutUpdate(s.clock.day);
        return { ...s, discovery: { status: "done", step: 6 }, experiments, feed: [item, ...s.feed] };
      }),
    700,
  );
}
export function designProposal(id: string) {
  update((s) => ({
    ...s,
    experiments: s.experiments.map((e) => (e.id === id ? { ...e, stage: "designed" as const, design: null } : e)),
  }));
  setTimeout(
    () =>
      update((s) => {
        const target = s.experiments.find((e) => e.id === id);
        if (!target) return s;
        const design = designExperiment(target.proposal, PANTRY);
        const item: Update = {
          id: `${id}-designed`,
          day: s.clock.day,
          at: new Date().toISOString(),
          agent: "designer",
          kind: "milestone",
          title: "Design ready",
          body: `${design.looks} looks over ${design.durationDays} days. ${(design.allocation * 100).toFixed(0)}% of eligible traffic.`,
        };
        let next = {
          ...s,
          experiments: s.experiments.map((e) =>
            e.id === id ? { ...e, design, stage: "designed" as const, updates: [item], run: null } : e,
          ),
          feed: [item, ...s.feed].slice(0, 200),
        };
        if (s.autonomy === "auto") next = launch(next, id);
        return next;
      }),
    1500,
  );
}
function launch(s: LabState, id: string): LabState {
  const target = s.experiments.find((e) => e.id === id);
  if (!target?.design) return s;
  const blocker = s.experiments.find(
    (e) => e.id !== id && e.stage === "running" && PANTRY.conflicts(e.proposal, target.proposal),
  );
  return {
    ...s,
    experiments: s.experiments.map((e) =>
      e.id === id
        ? {
            ...e,
            stage: blocker ? "queued" : "running",
            queuedBehind: blocker?.id ?? null,
            launchedDay: blocker ? null : s.clock.day,
            run: materializeRun(e),
          }
        : e,
    ),
  };
}
export function approveLaunch(id: string) {
  update((s) => launch(s, id));
}
export function rejectProposal(id: string) {
  update((s) => ({ ...s, experiments: s.experiments.map((e) => (e.id === id ? { ...e, stage: "rejected" } : e)) }));
}
export function setAutonomy(autonomy: "ask" | "auto") {
  update((s) => ({ ...s, autonomy }));
}
export function approveShip(id: string) {
  update((s) => {
    const item: Update = {
      id: `${id}-merged`,
      day: s.clock.day,
      at: new Date().toISOString(),
      agent: "shipper",
      kind: "decision",
      title: "Merged",
      body: "Merged the winner. Experiment flag removed and production checks passed.",
    };
    return {
      ...s,
      experiments: s.experiments.map((e) =>
        e.id === id && e.ship
          ? { ...e, stage: "shipped", ship: { ...e.ship, status: "merged" }, updates: [...e.updates, item] }
          : e,
      ),
      feed: [item, ...s.feed],
    };
  });
}
export function requestChanges(id: string, note: string) {
  update((s) => ({
    ...s,
    experiments: s.experiments.map((e) =>
      e.id === id && e.ship ? { ...e, ship: { ...e.ship, status: "changes_requested", note } } : e,
    ),
  }));
}
export function resetDemo() {
  if (discoveryTimer) clearInterval(discoveryTimer);
  write(EMPTY);
}

function fallbackIdea(text: string): Proposal {
  const lower = text.toLowerCase();
  const objective: Objective = /pay|premium|trial/.test(lower)
    ? "conversion"
    : /ad|revenue/.test(lower)
      ? "monetization"
      : /complete|ingredient/.test(lower)
        ? "engagement"
        : "retention";
  return {
    id: `custom-${Date.now()}`,
    title: text.slice(0, 72),
    objective,
    hypothesis: `If Pantry ${text.toLowerCase()}, the ${objective} objective will improve.`,
    why: "A customer idea to check against Pantry’s evidence.",
    evidenceIds: ["e1", "e4"],
    page: "/recipes/[slug]",
    files: ["src/components/recipe/RecipeView.tsx"],
    expectedLift: 0.04,
    confidence: "low",
    impactScore: 45,
    risk: "Kismet will watch the normal objective guardrails.",
    treatment: text,
    followUp: "Try a narrower version with new cooks.",
  };
}
export async function addCustomIdea(text: string): Promise<string | null> {
  const idea = text.trim().slice(0, 1000);
  if (!idea) return null;
  let proposal = fallbackIdea(idea);
  let error: string | null = null;
  try {
    const response = await fetch("/api/lab/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    if (!response.ok) throw new Error();
    proposal = (await response.json()) as Proposal;
  } catch {
    error = "The model was unavailable, so Kismet used Pantry’s rules.";
  }
  update((s) => ({
    ...s,
    customError: error,
    experiments: [
      ...s.experiments,
      {
        id: proposal.id,
        proposal,
        design: null,
        stage: "proposed",
        launchedDay: null,
        stopDay: null,
        stopReason: null,
        seed: 18 + proposal.id.length,
        truthKey: null,
        truth: { d7_return: { new: 0.04, casual: 0.02 } } as ScenarioTruth,
        run: null,
        readout: null,
        ship: null,
        updates: [],
        queuedBehind: null,
      },
    ],
  }));
  return proposal.id;
}
