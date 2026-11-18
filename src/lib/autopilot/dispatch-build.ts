import "server-only";

import { failBuild, finishBuild } from "@/lib/autopilot/agent-build";
import { experimentBranch, experimentTask } from "@/lib/autopilot/agent-task";
import { BUILDER_NAME, type OutsideBuilder } from "@/lib/autopilot/builders";
import { buildProgress, launchBuild } from "@/lib/autopilot/dispatch";
import { autopilotRepo, defaultAutopilotRepo } from "@/lib/autopilot/repo";
import { listExperiments, listSignals, log, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { CursorApiError } from "@/lib/cursor/client";
import { GitHubApiError, repoDefaultBranch } from "@/lib/github/client";

/** Hands one designed experiment to the account's own coding agent. One build runs at a time. */
export async function startDispatchBuild(
  experiment: Experiment,
  signal: Signal | undefined,
  builder: OutsideBuilder,
): Promise<string | null> {
  const active = (await listExperiments()).some((item) =>
    item.id !== experiment.id && item.status === "building" && (item.coderSessionId || item.buildRef),
  );
  if (active) return null;
  const name = BUILDER_NAME[builder];
  try {
    const repo = await autopilotRepo();
    const launched = await launchBuild(builder, {
      repo,
      base: await repoDefaultBranch(repo),
      branch: experimentBranch(experiment.flag),
      title: `Experiment: ${experiment.title}`.slice(0, 80),
      task: experimentTask(experiment, signal, repo !== defaultAutopilotRepo(), true),
    });
    await updateExperiment(experiment.id, {
      builder,
      buildRef: launched.ref,
      buildUrl: launched.url,
      buildStartedAt: new Date().toISOString(),
      note: `${name} is writing this change.`,
    });
  } catch (error) {
    const hint =
      error instanceof GitHubApiError || error instanceof CursorApiError
        ? error.hint ?? error.message
        : error instanceof Error ? error.message : String(error);
    await updateExperiment(experiment.id, { note: `Could not build yet: ${hint}` });
    throw new Error(hint);
  }
  await log("build", `${name} started building “${experiment.title}”.`, experiment.id);
  return `${name} started building “${experiment.title}”.`;
}

async function followOne(experiment: Experiment, signal: Signal | undefined, repo: string): Promise<string | null> {
  const { progress, url } = await buildProgress(experiment, repo);
  if (progress.state === "failed") return failBuild(experiment, progress.reason);
  if (progress.state === "finished") {
    return finishBuild(experiment, signal, experimentBranch(experiment.flag), BUILDER_NAME[experiment.builder!]);
  }
  if (url && url !== experiment.buildUrl) await updateExperiment(experiment.id, { buildUrl: url });
  return null;
}

/** Follows builds on Cursor or Claude Code: a finished one gets its pull request, a failed one is recorded. */
export async function followDispatchBuilds(): Promise<string | null> {
  const active = (await listExperiments()).filter((item) => item.status === "building" && item.builder && item.buildRef);
  if (active.length === 0) return null;
  const [signals, repo] = await Promise.all([listSignals(), autopilotRepo()]);
  const messages: string[] = [];
  for (const experiment of active) {
    const signal = signals.find((item) => item.id === experiment.signalId);
    const message = await followOne(experiment, signal, repo);
    if (message) messages.push(message);
  }
  return messages.length ? messages.join(" ") : null;
}
