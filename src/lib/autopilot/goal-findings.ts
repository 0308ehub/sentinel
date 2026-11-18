import "server-only";

import { computeGoalFindings, retentionFinding } from "@/lib/autopilot/goal-finding-math";
import { addEvidence, goalVisitorRows, listGoals, refreshEvidenceTitled, retentionCohort, type NewEvidence } from "@/lib/autopilot/store";
import { minPageVisitors } from "@/lib/autopilot/thresholds";

export async function goalFindings(): Promise<string | null> {
  const limit = 6;
  const found: NewEvidence[] = [];
  let emitted = 0;
  const min = minPageVisitors();
  for (const goal of await listGoals()) {
    const rows = await goalVisitorRows(goal.spec);
    for (const finding of computeGoalFindings({ goal: goal.name, now: new Date(), minVisitors: min, visitors: rows })) {
      if (emitted >= limit) break;
      emitted++;
      if (!(await refreshEvidenceTitled(finding.title, finding.body))) {
        found.push({ source: "analytics", synthetic: false, title: finding.title, body: finding.body, author: "Kismet analytics" });
      }
    }
  }
  if (emitted < limit) {
    const cohort = await retentionCohort();
    const finding = retentionFinding(cohort.eligible, cohort.returned, min);
    if (finding) {
      emitted++;
      if (!(await refreshEvidenceTitled(finding.title, finding.body))) found.push({ source: "analytics", synthetic: false, ...finding, author: "Kismet analytics" });
    }
  }
  await addEvidence(found.slice(0, limit));
  return emitted ? `Measured ${emitted} goal finding(s).` : null;
}
