import "server-only";

import { experimentBranch, experimentTask, gateInPatch, pullBody } from "@/lib/autopilot/agent-task";
import { cancelOutsideBuild } from "@/lib/autopilot/dispatch";
import { autopilotDryRun, autopilotRepo, defaultAutopilotRepo } from "@/lib/autopilot/repo";
import { autopilotUser } from "@/lib/autopilot/scope";
import { listExperiments, listSignals, log, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import { isLocalSource } from "@/lib/autopilot/source";
import { startSnapshot } from "@/lib/autopilot/snapshots";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { client, coderConfigured, managedSessionView, SESSION_BUDGET_CENTS } from "@/lib/coder/sessions";
import { githubTokenFor } from "@/lib/github/app";
import { closePull, compareFiles, createPullFromBranch, deleteBranch, readFile, repoDefaultBranch } from "@/lib/github/client";

async function githubToken(repo?: string): Promise<string> {
  return githubTokenFor(autopilotUser(), repo);
}

export async function agentBuildAvailable(): Promise<boolean> {
  if (!coderConfigured() || autopilotDryRun() || isLocalSource()) return false;
  const repo = await autopilotRepo().catch(() => undefined);
  return Boolean(await githubToken(repo).catch(() => ""));
}

export async function startAgentBuild(experiment: Experiment, signal: Signal | undefined): Promise<string | null> {
  const active = (await listExperiments()).some((item) =>
    item.id !== experiment.id && item.status === "building" && (item.coderSessionId || item.buildRef),
  );
  if (active) return null;
  const repo = await autopilotRepo();
  const token = await githubToken(repo);
  if (!token) return null;
  const external = repo !== defaultAutopilotRepo();
  const session = await client().beta.sessions.create({
    agent: process.env.KISMET_CODER_AGENT_ID!,
    environment_id: process.env.KISMET_CODER_ENVIRONMENT_ID!,
    title: `Experiment: ${experiment.title}`.slice(0, 80),
    budget: { type: "limit", max_list_cost: { amount: SESSION_BUDGET_CENTS, currency: "USD" } },
    metadata: { kismet_user: autopilotUser(), kismet_experiment: experiment.id },
    resources: [{ type: "github_repository", url: `https://github.com/${repo}`, authorization_token: token,
      mount_path: "/workspace/repo" }],
    initial_events: [{ type: "user.message", content: [{ type: "text", text: experimentTask(experiment, signal, external) }] }],
  });
  await updateExperiment(experiment.id, {
    coderSessionId: session.id,
    note: "Kismet's coding agent is building this change.",
  });
  await log("build", `Kismet's coding agent started building “${experiment.title}”.`, experiment.id);
  return `Kismet's coding agent started building “${experiment.title}”.`;
}

/** Records a build that produced no usable change, whichever agent ran it, and reopens the problem. */
export async function failBuild(experiment: Experiment, reason: string): Promise<string> {
  const note = `Could not build: ${reason}`;
  await updateExperiment(experiment.id, {
    status: "failed",
    coderSessionId: null,
    agentFailed: true,
    endedAt: new Date().toISOString(),
    note,
  });
  await setSignalStatus(experiment.signalId, "open");
  await log("build", `${note} (“${experiment.title}”).`, experiment.id);
  return note;
}

/** Checks the branch an agent pushed for the experiment gate, then opens the pull request. */
export async function finishBuild(
  experiment: Experiment,
  signal: Signal | undefined,
  branch: string,
  by = "Kismet's coding agent",
): Promise<string> {
  const repo = await autopilotRepo();
  const base = await repoDefaultBranch(repo);
  const files = await compareFiles(repo, base, branch);
  const external = repo !== defaultAutopilotRepo();
  const gate = external ? `kismet.variant("${experiment.flag}")` : `useVariant("${experiment.flag}")`;
  if (!gateInPatch(files, gate)) return failBuild(experiment, "the coding agent did not add the experiment gate");
  const changed = files.find((file) => file.patch?.includes(gate));
  if (!changed) return failBuild(experiment, "the gated file could not be found");
  const [draft, original] = await Promise.all([
    readFile(repo, changed.filename, branch),
    readFile(repo, changed.filename, base),
  ]);
  if (!draft || !original) return failBuild(experiment, "the gated file could not be read");
  const pull = await createPullFromBranch(
    repo, branch, base, `Experiment: ${experiment.title}`, pullBody(experiment, signal, experiment.treatment),
  );
  await updateExperiment(experiment.id, {
    status: "awaiting_approval", prUrl: pull.url, prNumber: pull.number, branch,
    draftPath: changed.filename, draft: draft.content, original: original.content,
    note: `Built by ${by}. Waiting for the preview build.`,
  });
  await log("build", `Opened PR #${pull.number} for “${experiment.title}”.`, experiment.id);
  if (experiment.changeSummary?.kind === "ui") {
    await startSnapshot(
      { ...experiment, status: "awaiting_approval", prUrl: pull.url, prNumber: pull.number, branch },
      experiment.changeSummary,
    ).catch((error) => console.error("[autopilot] could not start sample preview", error));
  }
  return `Opened a pull request for “${experiment.title}”.`;
}

async function followOne(experiment: Experiment, signal: Signal | undefined): Promise<string | null> {
  const view = await managedSessionView(experiment.coderSessionId!);
  if (view.stopReason === "requires_action" && view.pendingApproval) {
    await client().beta.sessions.events.send(experiment.coderSessionId!, { events: [{
      type: "user.tool_confirmation", tool_use_id: view.pendingApproval.toolUseId, result: "deny",
      deny_message: "Nobody is watching this build; skip steps that need approval and finish without them.",
    }] });
    await log("build", `Denied an unattended approval while building “${experiment.title}”.`, experiment.id);
    return null;
  }
  if (view.status === "running" || view.status === "rescheduling") return null;
  if (view.status === "idle" && view.stopReason === "end_turn" && view.branch) {
    return finishBuild(experiment, signal, view.branch);
  }
  const said = [...view.items].reverse().find((item) => item.kind === "agent" && item.text);
  const explanation = said && said.kind === "agent" ? said.text.split("\n").map((line) => line.trim()).find(Boolean)?.slice(0, 240) : "";
  const reason = view.status === "terminated" ? "the coding session terminated" :
    view.stopReason === "budget_reached" ? "the coding session reached its budget" :
      view.branch ? "the coding session did not finish normally" :
        explanation || "the coding agent did not report a branch";
  return failBuild(experiment, reason);
}

/** Stops a build the person does not want and removes its unmerged branch. */
export async function cancelBuild(experiment: Experiment): Promise<string> {
  if (experiment.status !== "building" && experiment.status !== "awaiting_approval") {
    throw new Error("This experiment is not being written.");
  }
  const sessionId = experiment.coderSessionId;
  await updateExperiment(experiment.id, {
    status: "rejected",
    rejectedBy: "person",
    coderSessionId: null,
    endedAt: new Date().toISOString(),
    note: "Stopped by you. The unmerged change was removed.",
  });
  await setSignalStatus(experiment.signalId, "open");
  let branch = experiment.branch;
  if (sessionId) {
    await client().beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] }).catch(() => {});
    if (!branch) {
      const view = await managedSessionView(sessionId).catch(() => null);
      branch = view?.branch ?? null;
    }
  }
  const repo = await autopilotRepo().catch(() => "");
  if (repo && experiment.builder && experiment.buildRef) await cancelOutsideBuild(experiment, repo).catch(() => {});
  if (repo && experiment.prNumber) await closePull(repo, experiment.prNumber).catch(() => {});
  const branches = new Set([branch, experimentBranch(experiment.flag)].filter((name): name is string => Boolean(name)));
  if (repo) {
    for (const name of branches) await deleteBranch(repo, name).catch(() => {});
  }
  await log("build", `You stopped “${experiment.title}” and removed the unmerged change.`, experiment.id);
  return "Stopped. The unmerged change was removed.";
}

export async function followAgentBuilds(): Promise<string | null> {
  const experiments = await listExperiments();
  const signals = await listSignals();
  const active = experiments.filter((item) => item.status === "building" && item.coderSessionId);
  const messages: string[] = [];
  for (const experiment of active) {
    const signal = signals.find((item) => item.id === experiment.signalId);
    const message = await followOne(experiment, signal);
    if (message) messages.push(message);
  }
  return messages.length ? messages.join(" ") : null;
}
