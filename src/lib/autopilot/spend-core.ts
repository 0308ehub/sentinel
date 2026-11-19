export const SPEND_KINDS = ["build", "render", "model", "chat"] as const;
export type SpendCategory = (typeof SPEND_KINDS)[number];

export interface SpendAmounts {
  buildCents: number;
  renderCents: number;
  modelCents: number;
  chatCents: number;
}

export interface ActivityCount {
  kind: string;
  count: number;
}

const ACTIVITY_LABELS: Record<string, [string, string]> = {
  triage: ["problem triaged", "problems triaged"],
  design: ["experiment designed", "experiments designed"],
  build: ["build update", "build updates"],
  gate: ["launch or ship decision", "launch or ship decisions"],
  iterate: ["experiment turned off", "experiments turned off"],
  measure: ["experiment measured", "experiments measured"],
  learn: ["learning recorded", "learnings recorded"],
  "verify-fix": ["fix checked", "fixes checked"],
  cleanup: ["cleanup", "cleanups"],
  error: ["error", "errors"],
};

// Routine bookkeeping that happens every tick; counting it would bury the real work.
const IGNORED_ACTIVITY = new Set(["tick", "cluster"]);

export function formatDollars(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export function activityLabel(kind: string, count: number): string {
  const labels = ACTIVITY_LABELS[kind] ?? ["other action", "other actions"];
  return `${count} ${count === 1 ? labels[0] : labels[1]}`;
}

export function activitySummary(rows: ActivityCount[]): string[] {
  const known: ActivityCount[] = [];
  let other = 0;
  for (const row of rows) {
    if (IGNORED_ACTIVITY.has(row.kind)) continue;
    if (ACTIVITY_LABELS[row.kind]) known.push(row);
    else other += row.count;
  }
  return [...known.map((row) => activityLabel(row.kind, row.count)), ...(other ? [activityLabel("other", other)] : [])];
}

export function utcDays(days: number, now = new Date()): string[] {
  const count = Math.max(0, Math.floor(days));
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: count }, (_, index) => new Date(end - (count - index - 1) * 86_400_000).toISOString().slice(0, 10));
}

export function spendTotal(amounts: SpendAmounts): number {
  return amounts.buildCents + amounts.renderCents + amounts.modelCents + amounts.chatCents;
}

export function stackWidths(amounts: SpendAmounts): Record<SpendCategory, number> {
  const total = spendTotal(amounts);
  if (total <= 0) return { build: 0, render: 0, model: 0, chat: 0 };
  return {
    build: (amounts.buildCents / total) * 100,
    render: (amounts.renderCents / total) * 100,
    model: (amounts.modelCents / total) * 100,
    chat: (amounts.chatCents / total) * 100,
  };
}
