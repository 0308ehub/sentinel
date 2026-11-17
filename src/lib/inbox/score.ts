export type Tier = "LOG" | "DIGEST" | "NUDGE" | "INTERRUPT";
export type NotifyMode = "session" | "hours" | "always";
export type WorkKind = "reply" | "card" | "edit" | "page";

export const TIER_SCORE = { interrupt: 0.55, nudge: 0.28, digest: 0.12 } as const;

const ORDER: Tier[] = ["LOG", "DIGEST", "NUDGE", "INTERRUPT"];

export interface ScoreInput {
  evidence: number;
  impact: number;
  urgency: number;
  relevance: number;
  interruptionCost: number;
}

export interface JudgeInput extends ScoreInput {
  id: string;
  ignoredStreak: number;
  muted: boolean;
  interruptsLeft: number;
}

export interface Judged {
  id: string;
  score: number;
  tier: Tier;
  explanation: string;
}

export interface DeliveryContext {
  mode: NotifyMode;
  withinHours: boolean;
  sessionStart: boolean;
  cap: number;
  interruptsLeft: number;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function pct(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

export function rawScore(input: ScoreInput): number {
  const evidence = clamp01(input.evidence);
  const impact = clamp01(input.impact);
  const urgency = clamp01(input.urgency);
  const relevance = clamp(input.relevance, 0, 2);
  const cost = clamp01(input.interruptionCost);
  return evidence * impact * urgency * relevance - cost;
}

export function tierForScore(score: number): Tier {
  if (score >= TIER_SCORE.interrupt) return "INTERRUPT";
  if (score >= TIER_SCORE.nudge) return "NUDGE";
  if (score >= TIER_SCORE.digest) return "DIGEST";
  return "LOG";
}

export function dampenTier(tier: Tier, ignoredStreak: number): Tier {
  const steps = ignoredStreak >= 6 ? 2 : ignoredStreak >= 3 ? 1 : 0;
  return ORDER[Math.max(0, ORDER.indexOf(tier) - steps)];
}

export function nextWeight(weight: number, event: "dismiss" | "approve" | "never"): number {
  if (event === "never") return 0.25;
  if (event === "approve") return clamp(weight * 1.15, 0.25, 2);
  return clamp(weight * 0.8, 0.25, 2);
}

export function withinWorkingHours(now: Date, startHour: number, endHour: number, offsetMinutes: number): boolean {
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const hour = local.getUTCHours();
  const start = clamp(Math.trunc(startHour), 0, 23);
  const end = clamp(Math.trunc(endHour), 1, 24);
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function shouldOpenSession(input: {
  kind: WorkKind;
  lastAt: number | null;
  now: number;
  idleMs: number;
  withinHours: boolean;
  mode: NotifyMode;
}): boolean {
  if (input.kind !== "reply" && input.kind !== "card" && input.kind !== "edit") return false;
  if (input.mode !== "always" && !input.withinHours) return false;
  if (input.lastAt == null) return true;
  return input.now - input.lastAt >= input.idleMs;
}

export function isHeldBack(
  item: { id: string; semanticKey: string; snoozeUntil: number | null },
  sent: { ids: Set<string>; keys: Set<string> },
  now: number,
): boolean {
  if (sent.ids.has(item.id) || sent.keys.has(item.semanticKey)) return true;
  return item.snoozeUntil != null && item.snoozeUntil > now;
}

export function judge(input: JudgeInput): Judged {
  const notes: string[] = [];
  const score = rawScore(input);
  let tier = tierForScore(score);
  if (input.muted) {
    tier = "LOG";
    notes.push("Agent is muted.");
  } else {
    const dampened = dampenTier(tier, input.ignoredStreak);
    if (dampened !== tier) {
      notes.push(`Ignored ${input.ignoredStreak} times, so this waits.`);
      tier = dampened;
    }
    if (tier === "INTERRUPT" && input.interruptsLeft <= 0) {
      tier = "NUDGE";
      notes.push("Daily interruption budget is used.");
    }
  }
  const explanation = [
    `Evidence ${pct(input.evidence)}, impact ${pct(input.impact)}, urgency ${pct(input.urgency)}, relevance ${clamp(input.relevance, 0, 2).toFixed(2)}.`,
    `Interruption cost ${pct(input.interruptionCost)}.`,
    `Score ${score.toFixed(2)} → ${tier}.`,
    ...notes,
  ].join(" ");
  return { id: input.id, score, tier, explanation };
}

export function selectDelivery<T extends { id: string; score: number; tier: Tier }>(items: T[], ctx: DeliveryContext): T[] {
  if (ctx.mode !== "always" && !ctx.withinHours) return [];
  const eligible = items.filter((item) => item.tier !== "LOG");
  let pool: T[];
  if (ctx.sessionStart) pool = eligible;
  else if (ctx.mode === "session") return [];
  else pool = eligible.filter((item) => item.tier === "NUDGE" || item.tier === "INTERRUPT");
  pool = [...pool].sort((a, b) => b.score - a.score);
  if (ctx.sessionStart) pool = pool.slice(0, Math.max(0, ctx.cap));
  let left = ctx.interruptsLeft;
  return pool.map((item) => {
    if (item.tier !== "INTERRUPT") return item;
    if (left > 0) {
      left -= 1;
      return item;
    }
    return { ...item, tier: "NUDGE" };
  });
}
