import "server-only";

import { addEvidence, elementStats, hasEvidenceTitled, type NewEvidence } from "@/lib/autopilot/store";

const WINDOW_DAYS = 7;
const MIN_PAGE_VISITORS = 50;
const LOW_CLICK_RATE = 0.03;
const REPEAT_AFTER_DAYS = 3;

/** Turns usage numbers into evidence: elements on busy pages that almost nobody clicks. */
export async function analyticsFindings(): Promise<string | null> {
  const stats = await elementStats(WINDOW_DAYS, MIN_PAGE_VISITORS);
  const found: NewEvidence[] = [];
  for (const stat of stats) {
    const rate = stat.clickers / stat.pageVisitors;
    if (rate >= LOW_CLICK_RATE) continue;
    const title = `Few visitors click “${stat.element}” on ${stat.page}`;
    if (await hasEvidenceTitled(title, REPEAT_AFTER_DAYS)) continue;
    found.push({
      source: "analytics",
      synthetic: stat.synthetic,
      title,
      body: `Only ${stat.clickers} of ${stat.pageVisitors} visitors (${(rate * 100).toFixed(1)}%) who opened ${stat.page} clicked “${stat.element}” in the last ${WINDOW_DAYS} days.`,
      author: "Kismet analytics",
    });
  }
  await addEvidence(found);
  return found.length ? `Found ${found.length} element(s) that visitors ignore.` : null;
}
