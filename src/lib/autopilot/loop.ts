import "server-only";

import { autopilotConfigured } from "@/lib/autopilot/db";
import { autopilotDryRun } from "@/lib/autopilot/repo";
import { isLocalSource, sourceLabel } from "@/lib/autopilot/source";
import { buildNext, followPulls } from "@/lib/autopilot/build";
import { buildCleanup, followCleanups } from "@/lib/autopilot/cleanup";
import { clusterEvidence } from "@/lib/autopilot/cluster";
import { designNext } from "@/lib/autopilot/design";
import { analyticsFindings } from "@/lib/autopilot/findings";
import { startExperiment, startQueued } from "@/lib/autopilot/lifecycle";
import { measureRunning } from "@/lib/autopilot/measure";
import { simulateTraffic } from "@/lib/autopilot/simulate";
import {
  evidenceCounts,
  lastRunAt,
  listActivity,
  listExperiments,
  listSignals,
  log,
  addEvidence,
  withTickLock,
} from "@/lib/autopilot/store";
import { syntheticEnabled, syntheticEvidence } from "@/lib/autopilot/synthetic";
import type { AutopilotState } from "@/lib/autopilot/types";

export interface TickResult {
  ran: boolean;
  steps: string[];
  errors: string[];
}

async function step(name: string, result: TickResult, fn: () => Promise<string | null>): Promise<void> {
  try {
    const message = await fn();
    if (message) result.steps.push(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`${name}: ${message}`);
    await log("error", `${name} failed: ${message}`).catch(() => {});
  }
}

/** One pass of the loop. Every step is safe to repeat, so a missed or doubled tick does no harm. */
export async function runTick(): Promise<TickResult> {
  const result: TickResult = { ran: false, steps: [], errors: [] };
  const outcome = await withTickLock(async () => {
    result.ran = true;

    const synthetic = syntheticEnabled();

    // Listen: new customer evidence and usage.
    await step("listen", result, async () => {
      if (!synthetic) return null;
      const added = await addEvidence(syntheticEvidence());
      return added ? `Collected ${added} pieces of synthetic evidence.` : null;
    });
    await step("traffic", result, async () => (synthetic ? simulateTraffic() : null));
    await step("analytics", result, analyticsFindings);

    // Notice: group evidence into problems.
    await step("notice", result, async () => {
      const sorted = await clusterEvidence();
      return sorted ? `Sorted ${sorted} pieces of evidence into problems.` : null;
    });

    // After the gate: follow PRs, measure live experiments, and act on results.
    await step("follow", result, () => followPulls(startExperiment));
    await step("measure", result, measureRunning);
    await step("queue", result, startQueued);

    // Decided experiments: remove the switch and the losing version from the code.
    await step("follow-cleanup", result, followCleanups);
    await step("cleanup", result, buildCleanup);

    // Before the gate: design the next experiment and build its PR.
    await step("design", result, designNext);
    await step("build", result, buildNext);

    await log("tick", result.errors.length ? `Ran with ${result.errors.length} error(s).` : "Ran.");
    return result;
  });
  return outcome ?? { ran: false, steps: ["Another run is already in progress."], errors: [] };
}

export async function autopilotState(): Promise<AutopilotState> {
  const empty: AutopilotState = {
    configured: autopilotConfigured(),
    signals: [],
    experiments: [],
    activity: [],
    lastRunAt: null,
    synthetic: syntheticEnabled(),
    dryRun: autopilotDryRun() || isLocalSource(),
    repo: sourceLabel(),
    summary: { evidenceThisWeek: 0, realThisWeek: 0, readySignals: 0, running: 0, needsYou: 0 },
  };
  if (!empty.configured) return empty;
  try {
    const [signals, experiments, activity, last, counts] = await Promise.all([
      listSignals(),
      listExperiments(),
      listActivity(),
      lastRunAt(),
      evidenceCounts(7),
    ]);
    return {
      ...empty,
      signals,
      experiments,
      activity,
      lastRunAt: last,
      summary: {
        evidenceThisWeek: counts.total,
        realThisWeek: counts.real,
        readySignals: signals.filter((s) => s.ready && s.status === "open").length,
        running: experiments.filter((e) => e.status === "running").length,
        needsYou: experiments.filter(
          (e) => e.status === "awaiting_approval" || e.status === "awaiting_rollout" || e.cleanup?.status === "awaiting"
        ).length,
      },
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Autopilot could not reach its database." };
  }
}
