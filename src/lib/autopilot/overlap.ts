import "server-only";

import { LAYER_SLOTS, type MetricSpec } from "@/lib/autopilot/assign";
import { countArmsAcross, listExperiments, listFlags, type CrossCount } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";

// How Autopilot keeps simultaneous experiments from corrupting each other:
//
// 1. Same file    → never at the same time. A second change to a file another experiment is still
//                   using waits, because the code itself would collide (and so would the cleanups).
// 2. Same page or → mutually exclusive. They share a layer whose visitors are split into separate
//    same metric    slices, so nobody sees both. If no slice is free, the newcomer queues.
// 3. Anything else → overlap, randomized independently, and checked for interactions: if one
//                   experiment's effect differs depending on the other's version, the result is held.

/** Experiments whose code is in flight or in the product, so their file is taken. */
const HOLDS_FILE = new Set(["building", "awaiting_approval", "queued", "running", "awaiting_rollout"]);
/** Experiments that are (or are about to be) splitting traffic. */
const LIVE = new Set(["running", "awaiting_rollout"]);
const PENDING = new Set(["building", "awaiting_approval", "queued"]);

/** The smallest share of a layer worth starting with; less would take too long to reach a result. */
const MIN_SLOTS = 30;
/** Two experiments must each have this many visitors in both versions of the other to judge an interaction. */
const MIN_CELL = 100;
const INTERACTION_Z = 2.58;

function holdsFile(e: Experiment): boolean {
  return HOLDS_FILE.has(e.status) || e.cleanup?.status === "building" || e.cleanup?.status === "awaiting";
}

/** Files that other experiments are still using, mapped to the experiment holding each. */
export async function lockedFiles(except: string): Promise<Map<string, Experiment>> {
  const locked = new Map<string, Experiment>();
  for (const e of await listExperiments()) {
    if (e.id !== except && e.draftPath && holdsFile(e)) locked.set(e.draftPath, e);
  }
  return locked;
}

function samePage(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\/\[[^\]]+\]/g, "/*").replace(/\/+$/, "") || "/";
  return Boolean(a && b) && norm(a) === norm(b);
}

function sameMetric(a: MetricSpec | null, b: MetricSpec | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "click" ? a.text.toLowerCase() === (b as typeof a).text.toLowerCase() : a.path === (b as typeof a).path;
}

export function conflicts(a: Experiment, b: Experiment): boolean {
  return a.id !== b.id && (samePage(a.page, b.page) || sameMetric(a.metricSpec, b.metricSpec));
}

function layerKey(e: Experiment): string {
  return `page:${e.page || e.flag}`;
}

/** The largest run of free slots in a layer. */
function freeRange(used: { start: number; end: number }[]): { start: number; end: number } {
  const sorted = [...used].sort((a, b) => a.start - b.start);
  let best = { start: 0, end: 0 };
  let cursor = 0;
  for (const range of [...sorted, { start: LAYER_SLOTS, end: LAYER_SLOTS }]) {
    if (range.start - cursor > best.end - best.start) best = { start: cursor, end: range.start };
    cursor = Math.max(cursor, range.end);
  }
  return best;
}

export type Placement =
  | { kind: "start"; layer: string | null; slotStart: number; slotEnd: number; note: string | null }
  | { kind: "wait"; note: string };

/** Where a newly approved experiment's traffic comes from, or why it has to wait. */
export async function place(experiment: Experiment): Promise<Placement> {
  const others = (await listExperiments()).filter((e) => e.id !== experiment.id);
  const live = others.filter((e) => LIVE.has(e.status) && conflicts(experiment, e));
  const pending = others.filter((e) => PENDING.has(e.status) && conflicts(experiment, e));

  if (live.length === 0) {
    // Leave room for a conflicting experiment that's already on its way, so it won't have to queue.
    const share = pending.length ? LAYER_SLOTS / 2 : LAYER_SLOTS;
    const note = pending.length
      ? `Shares ${experiment.page || "its page"} with “${pending[0].title}”, so it takes half the visitors and nobody sees both.`
      : null;
    return { kind: "start", layer: layerKey(experiment), slotStart: 0, slotEnd: share, note };
  }

  const flags = await listFlags();
  const liveFlags = flags.filter((f) => f.status === "running" && live.some((e) => e.flag === f.key));
  const layer = liveFlags[0]?.layer ?? layerKey(live[0]);
  const used = flags.filter((f) => f.status === "running" && f.layer === layer).map((f) => ({ start: f.slotStart, end: f.slotEnd }));
  const free = freeRange(used);
  const names = live.map((e) => `“${e.title}”`).join(" and ");

  if (free.end - free.start < MIN_SLOTS) {
    const verb = live.length === 1 ? "is" : "are";
    const finish = live.length === 1 ? "it finishes" : "one of them finishes";
    return { kind: "wait", note: `Queued: ${names} ${verb} testing the same page or metric. Starts automatically when ${finish}.` };
  }
  return {
    kind: "start",
    layer,
    slotStart: free.start,
    slotEnd: free.end,
    note: `Shares traffic with ${names}: each gets its own slice of visitors (${free.end - free.start}% for this one), so nobody sees both.`,
  };
}

function difference(cells: CrossCount[], otherArm: "control" | "treatment") {
  const c = cells.find((x) => x.arm === "control" && x.otherArm === otherArm);
  const t = cells.find((x) => x.arm === "treatment" && x.otherArm === otherArm);
  if (!c || !t || c.visitors < MIN_CELL || t.visitors < MIN_CELL) return null;
  const pc = c.conversions / c.visitors;
  const pt = t.conversions / t.visitors;
  return { diff: pt - pc, variance: (pc * (1 - pc)) / c.visitors + (pt * (1 - pt)) / t.visitors };
}

/**
 * Checks a running experiment against every other one it overlaps with. Returns the title of an
 * experiment that changes this one's effect, if any.
 */
export async function findInteraction(experiment: Experiment): Promise<string | null> {
  if (!experiment.startedAt || !experiment.metricSpec) return null;
  const others = (await listExperiments()).filter((e) => e.id !== experiment.id && LIVE.has(e.status));
  for (const other of others) {
    const cells = await countArmsAcross(experiment.flag, other.flag, experiment.startedAt, experiment.metricSpec);
    const withOld = difference(cells, "control");
    const withNew = difference(cells, "treatment");
    if (!withOld || !withNew) continue;
    const se = Math.sqrt(withOld.variance + withNew.variance);
    if (se > 0 && Math.abs(withOld.diff - withNew.diff) / se > INTERACTION_Z) return other.title;
  }
  return null;
}
