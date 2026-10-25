import "server-only";

import { autopilotDryRun, autopilotRepo } from "@/lib/autopilot/repo";
import { log, setFlag, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";
import { closePull, mergePull } from "@/lib/github/client";

/** The PR is merged: switch the flag on for a 50/50 split and start counting. */
export async function startExperiment(experiment: Experiment): Promise<void> {
  await setFlag(experiment.flag, "running", 50);
  await updateExperiment(experiment.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    note: "Shipped. Half of visitors see the new version.",
  });
  await setSignalStatus(experiment.signalId, "experimenting");
  await log("gate", `Started “${experiment.title}” for 50% of visitors.`, experiment.id);
}

export async function approve(experiment: Experiment): Promise<string> {
  if (experiment.status !== "awaiting_approval") throw new Error("This experiment isn't waiting for approval.");
  if (autopilotDryRun() && !experiment.prNumber) {
    await startExperiment(experiment);
    return "Started (dry run: nothing was merged, so only synthetic traffic will see it).";
  }
  if (!experiment.prNumber) throw new Error("This experiment has no pull request yet.");
  await mergePull(autopilotRepo(), experiment.prNumber, `Experiment: ${experiment.title}`);
  await startExperiment(experiment);
  return "Merged and started. The new version reaches half of visitors once the deploy finishes.";
}

export async function reject(experiment: Experiment): Promise<string> {
  if (experiment.status !== "awaiting_approval") throw new Error("This experiment isn't waiting for approval.");
  if (experiment.prNumber) await closePull(autopilotRepo(), experiment.prNumber).catch(() => {});
  await updateExperiment(experiment.id, { status: "rejected", endedAt: new Date().toISOString(), note: "Rejected by you." });
  await setSignalStatus(experiment.signalId, "open");
  await log("gate", `You rejected “${experiment.title}”. Autopilot will try a different idea.`, experiment.id);
  return "Rejected. Autopilot will try a different idea for this problem.";
}

export async function rollout(experiment: Experiment): Promise<string> {
  if (experiment.status !== "awaiting_rollout") throw new Error("This experiment hasn't won yet.");
  await setFlag(experiment.flag, "rolled_out", 100);
  await updateExperiment(experiment.id, { status: "rolled_out", endedAt: new Date().toISOString(), note: "Everyone sees the new version." });
  await setSignalStatus(experiment.signalId, "resolved");
  await log("gate", `Rolled out “${experiment.title}” to everyone.`, experiment.id);
  return "Rolled out to everyone.";
}

export async function stop(experiment: Experiment, note: string, reopen: boolean): Promise<void> {
  await setFlag(experiment.flag, "off");
  await updateExperiment(experiment.id, { status: "stopped", endedAt: new Date().toISOString(), note });
  if (reopen) await setSignalStatus(experiment.signalId, "open");
  await log("iterate", `Turned off “${experiment.title}”. ${note}`, experiment.id);
}
