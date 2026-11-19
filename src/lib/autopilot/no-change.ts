import "server-only";

import { insertLearning, log, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";

/** Records a deliberate no-change result so the same signal is not designed again. */
export async function recordNoChange(experiment: Experiment, reason: string): Promise<string> {
  const cleanReason = reason.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");
  const message = `No change needed for “${experiment.title}”: ${cleanReason}.`;
  await updateExperiment(experiment.id, {
    status: "rejected",
    rejectedBy: "kismet",
    coderSessionId: null,
    endedAt: new Date().toISOString(),
    note: `No change needed: ${cleanReason}.`,
  });
  await insertLearning({
    experimentId: experiment.id,
    signalId: experiment.signalId,
    kind: "rejected",
    outcome: "rejected",
    title: experiment.title,
    page: experiment.page,
    metric: experiment.metric,
    change: experiment.treatment,
    lift: null,
    pValue: null,
    visitors: null,
    learning: cleanReason,
  });
  await setSignalStatus(experiment.signalId, "dismissed");
  await log("design", message, experiment.id);
  return message;
}
