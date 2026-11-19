export interface DailyCount {
  day: string;
  series: string;
  visitors: number;
  conversions: number;
}

export interface DailyRate {
  day: string;
  [series: string]: string | number | null;
}

export interface SeriesTotal {
  visitors: number;
  conversions: number;
  rate: number | null;
}

const DAY_MS = 86_400_000;

export function utcDayRange(from: string, to: string): string[] {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  return Array.from({ length: Math.floor((end - start) / DAY_MS) + 1 }, (_, index) =>
    new Date(start + index * DAY_MS).toISOString().slice(0, 10),
  );
}

export function dailyRates(
  rows: readonly DailyCount[],
  series: readonly string[],
  from: string,
  to: string,
): DailyRate[] {
  const counts = new Map(rows.map((row) => [`${row.day}:${row.series}`, row]));
  return utcDayRange(from, to).map((day) => {
    const point: DailyRate = { day };
    for (const name of series) {
      const row = counts.get(`${day}:${name}`);
      point[name] = row?.visitors ? row.conversions / row.visitors : null;
    }
    return point;
  });
}

export function seriesTotals(rows: readonly DailyCount[], series: readonly string[]): Record<string, SeriesTotal> {
  return Object.fromEntries(series.map((name) => {
    const matching = rows.filter((row) => row.series === name);
    const visitors = matching.reduce((sum, row) => sum + row.visitors, 0);
    const conversions = matching.reduce((sum, row) => sum + row.conversions, 0);
    return [name, { visitors, conversions, rate: visitors ? conversions / visitors : null }];
  }));
}

export function relativeLift(control: number | null, treatment: number | null): number | null {
  return control == null || treatment == null || control === 0 ? null : treatment / control - 1;
}
