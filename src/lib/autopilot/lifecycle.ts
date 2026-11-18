import "server-only";

import { autopilotDryRun, autopilotRepo } from "@/lib/autopilot/repo";
import { isLocalSource } from "@/lib/autopilot/source";
import { place } from "@/lib/autopilot/overlap";
import { listExperiments, log, setFlag, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";
import { closePull, deleteBranch, mergePull } from "@/lib/github/client";

/**
 * The code is in: start the 50/50 split, in a slice of traffic that doesn't collide with other
 * experiments on the same page or metric. If there's no room yet, it queues and starts later.
 */
export async function startExperiment(experiment: Experiment): Promise<boolean> {
  if (experiment.kind === "fix") {
    const mergedAt = new Date().toISOString();
    await updateExperiment(experiment.id, {
      status: "rolled_out",
      startedAt: mergedAt,
      overlap: null,
      note: "Merged. Kismet is watching whether these complaints stop.",
    });
    await setSignalStatus(experiment.signalId, "experimenting");
    await log("gate", `Merged “${experiment.title}”. Kismet is watching for more complaints.`, experiment.id);
    return true;
  }
  if (experiment.kind === "change") {
    await setFlag(experiment.flag, "rolled_out", 100);
    await updateExperiment(experiment.id, {
      status: "running",
      startedAt: new Date().toISOString(),
      overlap: null,
      note: "Shipped to everyone. Turn it off any time.",
    });
    await setSignalStatus(experiment.signalId, "experimenting");
    await log("gate", `Shipped “${experiment.title}” to everyone behind a switch.`, experiment.id);
    return true;
  }
  const placement = await place(experiment);
  if (placement.kind === "wait") {
    await updateExperiment(experiment.id, { status: "queued", overlap: placement.note, note: "Shipped, waiting for its turn." });
    await setSignalStatus(experiment.signalId, "experimenting");
    await log("gate", `Queued “${experiment.title}”. ${placement.note}`, experiment.id);
    return false;
  }
  const share = placement.slotEnd - placement.slotStart;
  await setFlag(experiment.flag, "running", 50, {
    layer: placement.layer,
    slotStart: placement.slotStart,
    slotEnd: placement.slotEnd,
  });
  await updateExperiment(experiment.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    overlap: placement.note,
    note: share === 100 ? "Shipped. Half of visitors see the new version." : `Shipped. Half of its ${share}% slice of visitors see the new version.`,
  });
  await setSignalStatus(experiment.signalId, "experimenting");
  await log("gate", `Started “${experiment.title}”.${placement.note ? ` ${placement.note}` : ""}`, experiment.id);
  return true;
}

/** Starts queued experiments once the experiment they were waiting on has finished. */
export async function startQueued(): Promise<string | null> {
  const queued = (await listExperiments()).filter((e) => e.status === "queued").reverse();
  const started: string[] = [];
  for (const experiment of queued) {
    if (await startExperiment(experiment)) started.push(`Started “${experiment.title}”, which was queued.`);
  }
  return started.length ? started.join(" ") : null;
}

export async function approve(experiment: Experiment): Promise<string> {
  if (experiment.status !== "awaiting_approval") throw new Error("This experiment isn't waiting for approval.");
  if ((autopilotDryRun() || isLocalSource()) && !experiment.prNumber) {
    const started = await startExperiment(experiment);
    return started
      ? "Started (dry run: nothing was merged, so only synthetic traffic will see it)."
      : "Approved. It's queued behind an experiment on the same page and starts when that one finishes.";
  }
  if (!experiment.prNumber) throw new Error("This experiment has no pull request yet.");
  await mergePull(await autopilotRepo(), experiment.prNumber, experiment.kind === "fix" ? experiment.title : `Experiment: ${experiment.title}`);
  const started = await startExperiment(experiment);
  if (experiment.kind === "fix") return "Merged. Kismet is watching whether these complaints stop.";
  return started
    ? "Merged and started. The new version reaches its visitors once the deploy finishes."
    : "Merged. It's queued behind an experiment on the same page and starts when that one finishes.";
}

export async function reject(experiment: Experiment): Promise<string> {
  if (experiment.status !== "awaiting_approval") throw new Error("This experiment isn't waiting for approval.");
  const repo = await autopilotRepo();
  if (experiment.prNumber) await closePull(repo, experiment.prNumber).catch(() => {});
  if (experiment.branch) await deleteBranch(repo, experiment.branch).catch(() => {});
  await updateExperiment(experiment.id, { status: "rejected", rejectedBy: "person", endedAt: new Date().toISOString(), note: "Rejected by you." });
  await setSignalStatus(experiment.signalId, "open");
  await log("gate", `You rejected “${experiment.title}”. Kismet will try a different idea.`, experiment.id);
  return "Rejected. Kismet will try a different idea for this problem.";
}

export async function rollout(experiment: Experiment): Promise<string> {
  if (experiment.status === "rolled_out") throw new Error("This experiment is already rolled out.");
  if (experiment.status !== "awaiting_rollout") throw new Error("This experiment hasn't won yet.");
  await setFlag(experiment.flag, "rolled_out", 100);
  await updateExperiment(experiment.id, { status: "rolled_out", endedAt: new Date().toISOString(), note: "Everyone sees the new version." });
  await setSignalStatus(experiment.signalId, "resolved");
  await log("gate", `Rolled out “${experiment.title}” to everyone.`, experiment.id);
  return "Rolled out to everyone.";
}

export async function stop(experiment: Experiment, note: string, reopen: boolean): Promise<void> {
  await setFlag(experiment.flag, "off");
  // A queued experiment never got traffic, so there's nothing to measure and nothing it started.
  await updateExperiment(experiment.id, {
    status: "stopped",
    endedAt: new Date().toISOString(),
    note,
    ...(experiment.status === "queued" ? { overlap: null } : {}),
  });
  if (reopen) await setSignalStatus(experiment.signalId, "open");
  await log("iterate", `Turned off “${experiment.title}”. ${note}`, experiment.id);
}
