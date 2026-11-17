export const DEFAULT_MIN_PAGE_VISITORS = 20;

export function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function minPageVisitors(env: Record<string, string | undefined> = process.env): number {
  return positiveInteger(env.AUTOPILOT_MIN_PAGE_VISITORS, DEFAULT_MIN_PAGE_VISITORS);
}
