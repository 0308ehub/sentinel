export interface ActivityCounts {
  visitors: number;
  views: number;
  clicks: number;
  conversions: number;
}

export interface ActivityDay {
  day: string;
  control: ActivityCounts;
  treatment: ActivityCounts;
}

/** One grouped row from the activity query. Totals are distinct people; days are not added into them. */
export interface ActivityRow {
  grain: "day" | "total";
  day: string;
  arm: string;
  visitors: number;
  views: number;
  clicks: number;
  conversions: number;
}

export interface ExperimentActivity {
  /** People with at least one real visit, before sample traffic is removed. */
  humanVisitors: number;
  /** People who only produced simulated or automated visits. */
  syntheticVisitors: number;
  /** Planned share of people who should see the new version, from 0 to 100. */
  treatmentPct: number;
  /** True when the counted split is far from the plan. */
  uneven: boolean;
  totals: { control: ActivityCounts; treatment: ActivityCounts };
  days: ActivityDay[];
}

const AUTOMATED_AGENT =
  /googlebot|bingbot|baiduspider|yandexbot|duckduckbot|slurp|facebookexternalhit|linkedinbot|twitterbot|applebot|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|amazonbot|headlesschrome|phantomjs|selenium|puppeteer|playwright/i;

/** Crawler and automation user agents. Ordinary browsers, and a customer's own server, stay as people. */
export function isAutomatedAgent(userAgent: string | null | undefined): boolean {
  const value = userAgent?.trim() ?? "";
  return value.length > 0 && AUTOMATED_AGENT.test(value);
}

const EMPTY: ActivityCounts = { visitors: 0, views: 0, clicks: 0, conversions: 0 };

function counts(row: ActivityRow): ActivityCounts {
  return {
    visitors: row.visitors,
    views: row.views,
    clicks: row.clicks,
    conversions: row.conversions,
  };
}

function emptyDay(day: string): ActivityDay {
  return { day, control: { ...EMPTY }, treatment: { ...EMPTY } };
}

/**
 * Turns SQL groups into one total per version and one point per day.
 * `mix` is every person assigned to the experiment, including the simulated visits the totals leave out.
 */
export function foldActivity(
  rows: readonly ActivityRow[],
  mix: { human: number; synthetic: number },
  treatmentPct: number,
  uneven = false,
): ExperimentActivity {
  const totals: ExperimentActivity["totals"] = { control: { ...EMPTY }, treatment: { ...EMPTY } };
  const days = new Map<string, ActivityDay>();
  for (const row of rows) {
    if (row.arm !== "control" && row.arm !== "treatment") continue;
    if (row.grain === "total") {
      totals[row.arm] = counts(row);
      continue;
    }
    if (!row.day) continue;
    const day = days.get(row.day) ?? emptyDay(row.day);
    day[row.arm] = counts(row);
    days.set(row.day, day);
  }
  return {
    humanVisitors: mix.human,
    syntheticVisitors: mix.synthetic,
    treatmentPct,
    uneven,
    totals,
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}
