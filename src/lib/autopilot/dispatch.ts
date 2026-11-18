import "server-only";

import { experimentBranch } from "@/lib/autopilot/agent-task";
import { cursorKey } from "@/lib/autopilot/builder-store";
import {
  CLAUDE_WORKFLOW_FILE,
  CLAUDE_WORKFLOW_PATH,
  cursorProgress,
  cursorRef,
  parseCursorRef,
  pickWorkflowRun,
  workflowProgress,
  type BuildProgress,
  type OutsideBuilder,
} from "@/lib/autopilot/builders";
import { autopilotUser } from "@/lib/autopilot/scope";
import type { Experiment } from "@/lib/autopilot/types";
import { cancelCursorRun, createCursorAgent, cursorRunStatus } from "@/lib/cursor/client";
import {
  cancelWorkflowRun,
  createBranch,
  dispatchWorkflow,
  listWorkflowRuns,
  workflowState,
  type WorkflowState,
} from "@/lib/github/client";

// Starts, reads and stops a build on the account's own coding agent. In every case Kismet creates
// the experiment branch first and the agent pushes to it, so the rest of the loop sees one shape.

export const CURSOR_KEY_MESSAGE = "Add a Cursor API key in Settings → Connectors → GitHub so Cursor can write experiments.";

export const WORKFLOW_MESSAGE: Record<Exclude<WorkflowState, "ready">, string> = {
  missing: `Add ${CLAUDE_WORKFLOW_PATH} to the repository's default branch so Claude Code can write experiments. The file is in Settings → Connectors → GitHub.`,
  disabled: "The Kismet build workflow is turned off on GitHub. Turn it on under the repository's Actions tab.",
  forbidden: "The GitHub token cannot use Actions. Give it Actions read and write access.",
};

export interface LaunchedBuild {
  ref: string;
  url: string | null;
}

export async function launchBuild(
  builder: OutsideBuilder,
  input: { repo: string; base: string; branch: string; title: string; task: string },
): Promise<LaunchedBuild> {
  if (builder === "cursor") {
    const key = await cursorKey(autopilotUser());
    if (!key) throw new Error(CURSOR_KEY_MESSAGE);
    await createBranch(input.repo, input.branch, input.base);
    const agent = await createCursorAgent(key, {
      repo: input.repo,
      branch: input.branch,
      prompt: input.task,
      name: input.title,
    });
    return { ref: cursorRef(agent.agentId, agent.runId), url: agent.url };
  }
  const state = await workflowState(input.repo, CLAUDE_WORKFLOW_FILE);
  if (state !== "ready") throw new Error(WORKFLOW_MESSAGE[state]);
  await createBranch(input.repo, input.branch, input.base);
  await dispatchWorkflow(input.repo, CLAUDE_WORKFLOW_FILE, input.branch, { title: input.title, task: input.task });
  // The run is found by its branch later; until it is listed, link to the workflow's runs.
  return { ref: input.branch, url: `https://github.com/${input.repo}/actions/workflows/${CLAUDE_WORKFLOW_FILE}` };
}

async function claudeRun(experiment: Experiment, repo: string) {
  const runs = await listWorkflowRuns(repo, CLAUDE_WORKFLOW_FILE, experimentBranch(experiment.flag));
  return pickWorkflowRun(runs, experiment.buildStartedAt);
}

export async function buildProgress(
  experiment: Experiment,
  repo: string,
): Promise<{ progress: BuildProgress; url: string | null }> {
  if (experiment.builder === "cursor") {
    const ref = parseCursorRef(experiment.buildRef ?? "");
    if (!ref) return { progress: { state: "failed", reason: "the Cursor agent could not be found" }, url: experiment.buildUrl };
    const key = await cursorKey(autopilotUser());
    if (!key) throw new Error(CURSOR_KEY_MESSAGE);
    return { progress: cursorProgress(await cursorRunStatus(key, ref.agentId, ref.runId)), url: experiment.buildUrl };
  }
  const run = await claudeRun(experiment, repo);
  return { progress: workflowProgress(run, experiment.buildStartedAt, Date.now()), url: run?.url || experiment.buildUrl };
}

/** Stops the outside agent's run, if it is still going. */
export async function cancelOutsideBuild(experiment: Experiment, repo: string): Promise<void> {
  if (experiment.builder === "cursor") {
    const ref = parseCursorRef(experiment.buildRef ?? "");
    const key = await cursorKey(autopilotUser());
    if (ref && key) await cancelCursorRun(key, ref.agentId, ref.runId);
    return;
  }
  const run = await claudeRun(experiment, repo);
  if (run && run.status !== "completed") await cancelWorkflowRun(repo, run.id);
}
