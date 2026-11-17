import "server-only";

import { addEvidence, elementStats, refreshEvidenceTitled, type NewEvidence } from "@/lib/autopilot/store";
import { minPageVisitors } from "@/lib/autopilot/thresholds";

const WINDOW_DAYS = 7;
const LOW_CLICK_RATE = 0.03;

/** Turns usage numbers into evidence: elements on busy pages that almost nobody clicks. */
export async function analyticsFindings(): Promise<string | null> {
  const stats = await elementStats(WINDOW_DAYS, minPageVisitors());
  const found: NewEvidence[] = [];
  for (const stat of stats) {
    const rate = stat.clickers / stat.pageVisitors;
    if (rate >= LOW_CLICK_RATE) continue;
    const title = `Few visitors click “${stat.element}” on ${stat.page}`;
    const body = `Only ${stat.clickers} of ${stat.pageVisitors} visitors (${(rate * 100).toFixed(1)}%) who opened ${stat.page} clicked “${stat.element}” in the last ${WINDOW_DAYS} days.`;
    // The same finding measured again updates its numbers instead of counting as new evidence.
    if (await refreshEvidenceTitled(title, body)) continue;
    found.push({ source: "analytics", synthetic: stat.synthetic, title, body, author: "Kismet analytics" });
  }
  await addEvidence(found);
  return found.length ? `Found ${found.length} element(s) that visitors ignore.` : null;
}
