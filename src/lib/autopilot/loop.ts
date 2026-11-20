import "server-only";

import { autopilotConfigured } from "@/lib/autopilot/db";
import { autopilotDryRun, chosenAutopilotRepoReason, NO_REPO_MESSAGE } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { currentAccountId } from "@/lib/connections/current";
import { isLocalSource, sourceLabel } from "@/lib/autopilot/source";
import { buildNext, followPulls } from "@/lib/autopilot/build";
import { agentBuildAvailable, followAgentBuilds } from "@/lib/autopilot/agent-build";
import { followSnapshots } from "@/lib/autopilot/snapshots";
import { followDispatchBuilds } from "@/lib/autopilot/dispatch-build";
import { buildCleanup, followCleanups } from "@/lib/autopilot/cleanup";
import { clusterEvidence } from "@/lib/autopilot/cluster";
import { designNext } from "@/lib/autopilot/design";
import { workspaceEvidence } from "@/lib/autopilot/filed";
import { analyticsFindings } from "@/lib/autopilot/findings";
import { inferGoals } from "@/lib/autopilot/goals";
import { goalFindings } from "@/lib/autopilot/goal-findings";
import { advanceRollouts, startExperiment, startQueued } from "@/lib/autopilot/lifecycle";
import { measureRunning } from "@/lib/autopilot/measure";
import { learnFromFinished } from "@/lib/autopilot/learn";
import { sampleEvidenceCount } from "@/lib/autopilot/sample-data";
import { simulateTraffic } from "@/lib/autopilot/simulate";
import {
  claimLegacyRows,
  evidenceCreatedSince,
  evidenceCounts,
  lastRunAt,
  latestErrorMessage,
  listActivity,
  listExperiments,
  listLearnings,
  listGoals,
  listRatings,
  listSignals,
  log,
  addEvidence,
  retireStaleSignals,
  recentTickActivity,
  withTickLock,
} from "@/lib/autopilot/store";
import { syntheticEnabled, syntheticEvidence } from "@/lib/autopilot/synthetic";
import type { AutopilotState } from "@/lib/autopilot/types";
import { buildThemes } from "@/lib/autopilot/themes";
import { triageSignals } from "@/lib/autopilot/triage";
import { suggestIdeas } from "@/lib/autopilot/ideas";
import { buildRunReport, type RunReport, type RunSnapshot } from "@/lib/autopilot/run-report-core";
import { verifyFixes } from "@/lib/autopilot/verify-fixes";
import { notifySlack, postAccountAlert } from "@/lib/autopilot/notify";
import { refreshAgentSpend } from "@/lib/autopilot/spend";
import { alertDue, failureStreak } from "@/lib/autopilot/notify-core";
import { siteUrl } from "@/lib/site";
import { getConnection } from "@/lib/connections/store";

export interface TickResult {
  ran: boolean;
  steps: string[];
  errors: string[];
  report?: RunReport;
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
export async function runTick(userId: string, options: { manual?: boolean } = {}): Promise<TickResult> {
  await claimLegacyRows(userId);
  return withAutopilotUser(userId, () => runScopedTick(options));
}

function snapshot(
  signals: Awaited<ReturnType<typeof listSignals>>,
  experiments: Awaited<ReturnType<typeof listExperiments>>,
  evidenceBySource: Record<string, number>,
): RunSnapshot {
  return {
    signals: signals.map(({ id, title, status, kind }) => ({ id, title, status, kind })),
    experiments: experiments.map(({ id, title, status }) => ({ id, title, status })),
    evidenceBySource,
  };
}

async function runScopedTick(options: { manual?: boolean }): Promise<TickResult> {
  const result: TickResult = { ran: false, steps: [], errors: [] };
  const outcome = await withTickLock(async () => {
    result.ran = true;
    const tickStartedAt = new Date();
    const [startingSignals, startingExperiments] = await Promise.all([listSignals(), listExperiments()]);
    const before = snapshot(startingSignals, startingExperiments, {});
    const startingSignalIds = new Set(startingSignals.map((signal) => signal.id));
    const ideaSignalIds = new Set<string>();

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
    await step("freshness", result, retireStaleSignals);
    await step("goals", result, inferGoals);
    await step("goal-findings", result, goalFindings);

    // Notice: group evidence into problems.
    await step("notice", result, async () => {
      const sorted = await clusterEvidence();
      return sorted ? `Sorted ${sorted} pieces of evidence into problems.` : null;
    });
    await step("triage", result, triageSignals);
    if (options.manual) {
      const signalsAfterTriage = await listSignals();
      const alreadyCreated = signalsAfterTriage.some(
        (signal) => signal.status === "open" && !startingSignalIds.has(signal.id),
      );
      if (!alreadyCreated) {
        await step("ideas", result, async () => {
          const ideas = await suggestIdeas();
          for (const id of ideas.signalIds) ideaSignalIds.add(id);
          return ideas.message;
        });
      }
    }

    // Steps that touch code need a repository; an account that has not chosen one stops at noticing.
    if (!(await sourceLabel())) {
      await step("repo", result, async () => (await chosenAutopilotRepoReason()) ?? NO_REPO_MESSAGE);
      await step("learn", result, learnFromFinished);
    } else {
      // After the gate: follow PRs, measure live experiments, and act on results.
      await step("follow", result, () => followPulls(startExperiment));
      await step("measure", result, measureRunning);
      await step("verify-fixes", result, verifyFixes);
      await step("rollout", result, advanceRollouts);
      await step("learn", result, learnFromFinished);
      await step("queue", result, startQueued);

      // Decided experiments: remove the switch and the losing version from the code.
      await step("follow-cleanup", result, followCleanups);
      await step("cleanup", result, buildCleanup);

      // Before the gate: design the next experiment and build its PR.
      await step("design", result, designNext);
      await step("agent-build", result, followAgentBuilds);
      await step("snapshots", result, followSnapshots);
      await step("dispatch-build", result, followDispatchBuilds);
      await step("build", result, buildNext);
    }

    await step("notify", result, notifySlack);
    await step("spend", result, refreshAgentSpend);

    await log("tick", result.errors.length ? `Ran with ${result.errors.length} error(s).` : "Ran.");
    try {
      const ticks = await recentTickActivity(10);
      const due = alertDue(ticks.map((tick) => ({ message: tick.message, at: tick.at })));
      if (due) {
        const latest = (await latestErrorMessage())?.slice(0, 200) || "Unknown error";
        await postAccountAlert(due.key, `Kismet's last 3 runs had errors. Latest: ${latest}. ${siteUrl().replace(/\/$/, "")}/experiments`);
      }
    } catch (error) {
      console.error("[autopilot] could not send failing-run alert", error);
    }
    if (options.manual) {
      const [signals, experiments, evidenceBySource] = await Promise.all([
        listSignals(),
        listExperiments(),
        evidenceCreatedSince(tickStartedAt),
      ]);
      result.report = buildRunReport(
        before,
        snapshot(signals, experiments, evidenceBySource),
        result.steps,
        result.errors,
        ideaSignalIds,
      );
    }
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
    themes: [],
    ratings: [],
    experiments: [],
    learnings: [],
    goals: [],
    activity: [],
    lastRunAt: null,
    health: { failingRuns: 0, latestError: null, lastRunAt: null },
    setup: { slack: false, repo: false, agent: false, firstRun: false },
    synthetic: syntheticEnabled(),
    dryRun: autopilotDryRun() || isLocalSource(),
    repo: null,
    sampleEvidence: 0,
    summary: { evidenceThisWeek: 0, realThisWeek: 0, readySignals: 0, running: 0, needsYou: 0 },
  };
  if (!empty.configured) return empty;
  const userId = await currentAccountId();
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
      const [signals, experiments, learnings, goals, ratings, activity, last, counts, repo, sampleEvidence, ticks, latestError, slack, agent] = await Promise.all([
        listSignals(),
        listExperiments(),
        listLearnings(),
        listGoals(),
        listRatings(),
        listActivity(),
        lastRunAt(),
        evidenceCounts(7),
        sourceLabel(),
        sampleEvidenceCount(),
        recentTickActivity(10),
        latestErrorMessage(),
        getConnection(userId, "slack").then((connection) => Boolean(connection)).catch(() => false),
        agentBuildAvailable().catch(() => false),
      ]);
      return {
        ...empty,
        repo,
        sampleEvidence,
        signals,
        themes: buildThemes(signals, new Date()),
        ratings,
        experiments,
        learnings,
        goals,
        activity,
        lastRunAt: last,
        health: { failingRuns: failureStreak(ticks.map((tick) => tick.message)), latestError, lastRunAt: last },
        setup: { slack, repo: Boolean(repo), agent, firstRun: Boolean(last) },
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
