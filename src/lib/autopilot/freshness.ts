import type { EvidenceSource } from "@/lib/autopilot/types";

export const ANALYTICS_FRESH_DAYS = 2;
export const OTHER_FRESH_DAYS = 30;
export const ELEMENT_GONE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function otherFreshDays(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.AUTOPILOT_EVIDENCE_FRESH_DAYS;
  if (!value || !/^\d+$/.test(value)) return OTHER_FRESH_DAYS;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : OTHER_FRESH_DAYS;
}

export function freshDays(source: EvidenceSource, env: NodeJS.ProcessEnv = process.env): number {
  if (source === "interview") return Infinity;
  return source === "analytics" ? ANALYTICS_FRESH_DAYS : otherFreshDays(env);
}

export function isFresh(
  evidence: { source: EvidenceSource; occurredAt: string | Date },
  now: string | Date,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const occurredAt = new Date(evidence.occurredAt).getTime();
  const current = new Date(now).getTime();
  return Number.isFinite(occurredAt) && Number.isFinite(current) && occurredAt >= current - freshDays(evidence.source, env) * DAY_MS;
}

export function isElementCurrent(lastClickAt: string | Date, now: string | Date): boolean {
  const lastClick = new Date(lastClickAt).getTime();
  const current = new Date(now).getTime();
  return Number.isFinite(lastClick) && Number.isFinite(current) && lastClick >= current - ELEMENT_GONE_DAYS * DAY_MS;
}
