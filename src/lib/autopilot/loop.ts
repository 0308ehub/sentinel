import "server-only";

import { autopilotConfigured } from "@/lib/autopilot/db";
import { autopilotDryRun, NO_REPO_MESSAGE } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { currentUserId } from "@/lib/connections/current";
import { isLocalSource, sourceLabel } from "@/lib/autopilot/source";
import { buildNext, followPulls } from "@/lib/autopilot/build";
import { followAgentBuilds } from "@/lib/autopilot/agent-build";
import { followDispatchBuilds } from "@/lib/autopilot/dispatch-build";
import { buildCleanup, followCleanups } from "@/lib/autopilot/cleanup";
import { clusterEvidence } from "@/lib/autopilot/cluster";
import { designNext } from "@/lib/autopilot/design";
import { workspaceEvidence } from "@/lib/autopilot/filed";
import { analyticsFindings } from "@/lib/autopilot/findings";
import { startExperiment, startQueued } from "@/lib/autopilot/lifecycle";
import { measureRunning } from "@/lib/autopilot/measure";
import { sampleEvidenceCount } from "@/lib/autopilot/sample-data";
import { simulateTraffic } from "@/lib/autopilot/simulate";
import {
  claimLegacyRows,
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

/** One pass of one account's loop. Every step is safe to repeat, so a missed or doubled tick does no harm. */
export async function runTick(userId: string): Promise<TickResult> {
  await claimLegacyRows(userId);
  return withAutopilotUser(userId, () => runScopedTick());
}

async function runScopedTick(): Promise<TickResult> {
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
    await step("filed", result, workspaceEvidence);

    // Notice: group evidence into problems.
    await step("notice", result, async () => {
      const sorted = await clusterEvidence();
      return sorted ? `Sorted ${sorted} pieces of evidence into problems.` : null;
    });

    // Steps that touch code need a repository; an account that has not chosen one stops at noticing.
    if (!(await sourceLabel())) {
      await step("repo", result, async () => NO_REPO_MESSAGE);
    } else {
      // After the gate: follow PRs, measure live experiments, and act on results.
      await step("follow", result, () => followPulls(startExperiment));
      await step("measure", result, measureRunning);
      await step("queue", result, startQueued);

      // Decided experiments: remove the switch and the losing version from the code.
      await step("follow-cleanup", result, followCleanups);
      await step("cleanup", result, buildCleanup);

      // Before the gate: design the next experiment and build its PR.
      await step("design", result, designNext);
      await step("agent-build", result, followAgentBuilds);
      await step("dispatch-build", result, followDispatchBuilds);
      await step("build", result, buildNext);
    }

    await log("tick", result.errors.length ? `Ran with ${result.errors.length} error(s).` : "Ran.");
    return result;
  });
  return outcome ?? { ran: false, steps: ["Another run is already in progress."], errors: [] };
}

const DISPATCH_CHECK_MS = 30_000;
const dispatchChecked = new Map<string, number>();

/** An open page polls every few seconds; ask Cursor or GitHub about a build at most twice a minute. */
function dispatchCheckDue(userId: string): boolean {
  const now = Date.now();
  if (now - (dispatchChecked.get(userId) ?? 0) < DISPATCH_CHECK_MS) return false;
  dispatchChecked.set(userId, now);
  return true;
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
    repo: null,
    sampleEvidence: 0,
    summary: { evidenceThisWeek: 0, realThisWeek: 0, readySignals: 0, running: 0, needsYou: 0 },
  };
  if (!empty.configured) return empty;
  const userId = await currentUserId();
  if (!userId) return empty;
  try {
    await claimLegacyRows(userId);
    return await withAutopilotUser(userId, async () => {
      const before = await listExperiments();
      if (before.some((experiment) => experiment.status === "building" && experiment.coderSessionId)) {
        await followAgentBuilds().catch(async (error) => {
          const message = error instanceof Error ? error.message : String(error);
          await log("error", `agent-build failed: ${message}`).catch(() => {});
        });
      }
      // The hourly run is too slow for a build that takes minutes, so an open page checks on it too.
      if (before.some((experiment) => experiment.status === "building" && experiment.buildRef) && dispatchCheckDue(userId)) {
        await followDispatchBuilds().catch(async (error) => {
          const message = error instanceof Error ? error.message : String(error);
          await log("error", `dispatch-build failed: ${message}`).catch(() => {});
        });
      }
      const [signals, experiments, activity, last, counts, repo, sampleEvidence] = await Promise.all([
        listSignals(),
        listExperiments(),
        listActivity(),
        lastRunAt(),
        evidenceCounts(7),
        sourceLabel(),
        sampleEvidenceCount(),
      ]);
      return {
        ...empty,
        repo,
        sampleEvidence,
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
    });
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Kismet could not reach its database." };
  }
}
