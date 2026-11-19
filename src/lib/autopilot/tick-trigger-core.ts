export const TICK_TRIGGER_MINUTES = 5;

export function tickTriggerDue(lastRunAt: string | null, now: string | number | Date): boolean {
  if (!lastRunAt) return true;
  const last = Date.parse(lastRunAt);
  if (!Number.isFinite(last)) return true;
  return new Date(now).getTime() - last >= TICK_TRIGGER_MINUTES * 60_000;
}
