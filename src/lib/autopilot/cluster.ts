import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { assignEvidence, createSignal, listSignals, log, setSignalStatus, unassignedEvidence } from "@/lib/autopilot/store";
import type { Evidence, Signal } from "@/lib/autopilot/types";

interface ClusterAnswer {
  groups?: {
    signalId?: string | null;
    title?: string;
    problem?: string;
    area?: string;
    evidenceIds?: string[];
    isProblem?: boolean;
  }[];
}

const BATCH = 40;

// If the model call fails, the step errors and the evidence waits for the next tick.
async function proposeGroups(fresh: Evidence[], open: Signal[]): Promise<ClusterAnswer> {
  const text = await askForJson(
    [
      "You group customer evidence about a software product into distinct user problems.",
      "Join a piece of evidence to an existing problem only when it is clearly the same underlying problem.",
      "Otherwise start a new problem. Praise or chatter that describes no problem goes in its own group with isProblem false.",
      "A bug, a customer problem, or a Jira issue is a problem. Return JSON: {\"groups\":[{\"signalId\": existing id or null, \"title\": short problem title, \"problem\": one sentence on what users struggle with, \"area\": the page or feature, \"isProblem\": true or false, \"evidenceIds\": [ids]}]}.",
      "Every evidence id must appear in exactly one group. Titles describe the user's problem, not a solution.",
    ].join(" "),
    [
      "EXISTING PROBLEMS",
      ...(open.length ? open.map((s) => `${s.id} | ${s.title} | ${s.problem}`) : ["(none)"]),
      "",
      "NEW EVIDENCE",
      ...fresh.map((e) => `${e.id} | ${e.source} | ${e.title}${e.body ? ` — ${e.body.slice(0, 300)}` : ""}`),
    ].join("\n"),
    false,
    undefined,
    "recommendations"
  );
  return readJson<ClusterAnswer>(text);
}

/** Groups new evidence into problems: joins an existing signal when it is the same problem, otherwise starts one. */
export async function clusterEvidence(): Promise<number> {
  const fresh = await unassignedEvidence(BATCH);
  if (fresh.length === 0) return 0;
  const open = (await listSignals()).filter((s) => s.status !== "resolved").slice(0, 40);
  const answer = await proposeGroups(fresh, open);
  const known = new Set(open.map((s) => s.id));
  const freshIds = new Set(fresh.map((e) => e.id));
  let assigned = 0;
  let created = 0;

  for (const group of answer.groups ?? []) {
    const ids = (group.evidenceIds ?? []).filter((id) => freshIds.has(id));
    if (ids.length === 0) continue;
    let signalId = group.signalId && known.has(group.signalId) ? group.signalId : null;
    if (!signalId) {
      signalId = await createSignal({
        title: group.title?.trim() || "Untitled problem",
        problem: group.problem?.trim() || "",
        area: group.area?.trim() || "",
      });
      known.add(signalId);
      // Praise and chatter are kept as evidence but never treated as something to fix.
      if (group.isProblem === false) await setSignalStatus(signalId, "dismissed");
      else created++;
    }
    await assignEvidence(signalId, ids);
    ids.forEach((id) => freshIds.delete(id));
    assigned += ids.length;
  }

  // Evidence the model left out of every group still becomes its own problem.
  for (const item of fresh.filter((entry) => freshIds.has(entry.id))) {
    const signalId = await createSignal({ title: item.title.slice(0, 200), problem: item.body.slice(0, 280), area: "" });
    await assignEvidence(signalId, [item.id]);
    assigned += 1;
    created += 1;
  }

  if (assigned > 0) {
    await log("cluster", `Sorted ${assigned} new piece${assigned === 1 ? "" : "s"} of evidence${created ? `, found ${created} new problem${created === 1 ? "" : "s"}` : ""}.`);
  }
  return assigned;
}
