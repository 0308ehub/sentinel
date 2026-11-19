export type Arm = "control" | "treatment";

export interface FlagState {
  key: string;
  status: "off" | "running" | "rolled_out";
  treatmentPct: number;
  /**
   * Experiments that touch the same page or metric share a layer: the layer's visitors are cut into
   * 100 slots and each experiment owns its own range, so nobody is in two of them at once.
   */
  layer: string | null;
  slotStart: number;
  slotEnd: number;
}

export const LAYER_SLOTS = 100;

/**
 * How a metric is counted. All forms exist in control and treatment, so the arms are comparable.
 * An event is one the site reports itself with kismet.track, such as a purchase or a sign-up.
 */
export type MetricSpec = { kind: "click"; text: string } | { kind: "visit"; path: string } | { kind: "event"; name: string };

/** Names accepted by kismet.track, in the browser script and the server SDK. */
export const EVENT_NAME = /^[A-Za-z0-9_.:-]{1,80}$/;

// FNV-1a: stable, fast, and identical on server and client.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The arm a visitor is in, or null when the experiment doesn't include them (they're in another
 * experiment's slice of the same layer). Each experiment hashes with its own key, so experiments in
 * different layers are randomized independently of each other.
 */
export function armFor(visitor: string, flag: FlagState): Arm | null {
  if (flag.status === "rolled_out") return "treatment";
  if (flag.status !== "running") return null;
  if (flag.layer) {
    const slot = hash(`layer:${flag.layer}:${visitor}`) % LAYER_SLOTS;
    if (slot < flag.slotStart || slot >= flag.slotEnd) return null;
  }
  return hash(`${flag.key}:${visitor}`) % 100 < flag.treatmentPct ? "treatment" : "control";
}

export function parseMetricSpec(value: unknown): MetricSpec | null {
  if (!value || typeof value !== "object") return null;
  const spec = value as Record<string, unknown>;
  if (spec.kind === "click" && typeof spec.text === "string" && spec.text.trim()) {
    return { kind: "click", text: spec.text.trim().slice(0, 80) };
  }
  if (spec.kind === "visit" && typeof spec.path === "string" && spec.path.startsWith("/")) {
    return { kind: "visit", path: spec.path.trim().slice(0, 200) };
  }
  if (spec.kind === "event" && typeof spec.name === "string" && EVENT_NAME.test(spec.name.trim())) {
    return { kind: "event", name: spec.name.trim() };
  }
  return null;
}

export function describeMetric(spec: MetricSpec): string {
  if (spec.kind === "click") return `visitors who click “${spec.text}”`;
  if (spec.kind === "visit") return `visitors who reach ${spec.path}`;
  return `visitors who report “${spec.name}”`;
}

export function sameMetricSpec(a: MetricSpec | null, b: MetricSpec | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "click" && b.kind === "click") return a.text.toLowerCase() === b.text.toLowerCase();
  if (a.kind === "visit" && b.kind === "visit") return a.path === b.path;
  return a.kind === "event" && b.kind === "event" && a.name === b.name;
}
