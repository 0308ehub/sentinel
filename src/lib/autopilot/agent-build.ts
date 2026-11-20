import "server-only";

import { experimentBranch, experimentGate, experimentTask, fixPullBody, fixTask, gateInPatch, pullBody } from "@/lib/autopilot/agent-task";
import { SERVER_SDK_FILE } from "@/lib/sdk/kismet-server";
import { cancelOutsideBuild } from "@/lib/autopilot/dispatch";
import { autopilotDryRun, autopilotRepo, defaultAutopilotRepo } from "@/lib/autopilot/repo";
import { autopilotUser } from "@/lib/autopilot/scope";
import { accountDailyLimitCents, formatDollars } from "@/lib/autopilot/spend-core";
import { agentBudgetLeft, recordAgentSession } from "@/lib/autopilot/spend";
import { listExperiments, listSignals, log, setSignalStatus, snoozeSignal, updateExperiment } from "@/lib/autopilot/store";
import { isLocalSource } from "@/lib/autopilot/source";
import { startSnapshot } from "@/lib/autopilot/snapshots";
import { markerOnlyPatch, noChangeReason } from "@/lib/autopilot/no-change-core";
import { recordNoChange } from "@/lib/autopilot/no-change";
import { MAX_ATTEMPTS, buildStage, stallDecision } from "@/lib/autopilot/build-stage-core";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { client, coderConfigured, managedSessionView, SESSION_BUDGET_CENTS } from "@/lib/coder/sessions";
import { githubTokenFor } from "@/lib/github/app";
import { branchHeadSha, closePull, compareFiles, createPullFromBranch, deleteBranch, readFile, repoDefaultBranch } from "@/lib/github/client";

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
  if (await agentBudgetLeft() <= 0) {
    const note = `Paused: this account reached its daily spending limit (${formatDollars(accountDailyLimitCents())}). Kismet continues tomorrow.`;
    if (experiment.note !== note) {
      await updateExperiment(experiment.id, { note });
      await log("build", note, experiment.id);
    }
    return null;
  }
  const repo = await autopilotRepo();
  const token = await githubToken(repo);
  if (!token) return null;
  const external = repo !== defaultAutopilotRepo();
  // Pin the mount to the default branch's head right now; left unpinned, the session can start
  // from an older copy of the repository.
  const base = await repoDefaultBranch(repo);
  const head = await branchHeadSha(repo, base, token);
  const title = experiment.kind === "fix" ? experiment.title.slice(0, 80) : `Experiment: ${experiment.title}`.slice(0, 80);
  const userId = autopilotUser();
  const session = await client().beta.sessions.create({
    agent: process.env.KISMET_CODER_AGENT_ID!,
    environment_id: process.env.KISMET_CODER_ENVIRONMENT_ID!,
    title,
    budget: { type: "limit", max_list_cost: { amount: SESSION_BUDGET_CENTS, currency: "USD" } },
    metadata: { kismet_user: userId, kismet_experiment: experiment.id },
    resources: [{ type: "github_repository", url: `https://github.com/${repo}`, authorization_token: token,
      mount_path: "/workspace/repo", checkout: { type: "commit", sha: head } }],
    initial_events: [{ type: "user.message", content: [{ type: "text", text: experiment.kind === "fix" ? fixTask(experiment, signal) : experimentTask(experiment, signal, external) }] }],
  });
  await recordAgentSession({ sessionId: session.id, userId, kind: "build", experimentId: experiment.id, title }).catch(() => {});
  const now = new Date().toISOString();
  await updateExperiment(experiment.id, {
    coderSessionId: session.id,
    buildStartedAt: experiment.buildAttempts > 0 && experiment.buildStartedAt ? experiment.buildStartedAt : now,
    buildStage: "starting",
    buildStageAt: now,
    buildSteps: 0,
    note: "Kismet's coding agent is building this change.",
  });
  await log("build", `Kismet's coding agent started building “${experiment.title}”.`, experiment.id);
  return `Kismet's coding agent started building “${experiment.title}”.`;
}

function buildBranches(experiment: Experiment, reported: string | null): Set<string> {
  const fixBranch = `kismet/${experiment.flag.replace(/-v\d+$/, "")}`;
  return new Set([reported, experiment.branch, experimentBranch(experiment.flag), fixBranch].filter((name): name is string => Boolean(name)));
}

async function removePartialBranches(experiment: Experiment, reported: string | null): Promise<void> {
  const repo = await autopilotRepo().catch(() => "");
  if (!repo) return;
  for (const branch of buildBranches(experiment, reported)) await deleteBranch(repo, branch).catch(() => {});
}

async function restartBuild(
  experiment: Experiment,
  signal: Signal | undefined,
  sessionId: string,
  branch: string | null,
  message: string,
): Promise<string | null> {
  await client().beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] }).catch(() => {});
  const attempts = experiment.buildAttempts + 1;
  await updateExperiment(experiment.id, { coderSessionId: null, buildAttempts: attempts });
  await removePartialBranches(experiment, branch);
  await log("build", message, experiment.id);
  return startAgentBuild({ ...experiment, coderSessionId: null, buildAttempts: attempts }, signal);
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
  agentReport = "",
): Promise<string> {
  const repo = await autopilotRepo();
  const base = await repoDefaultBranch(repo);
  const files = await compareFiles(repo, base, branch);
  const external = repo !== defaultAutopilotRepo();
  const fix = experiment.kind === "fix";
  const gate = experimentGate(experiment.flag, external);
  if (!fix && !gateInPatch(files, gate)) return failBuild(experiment, "the coding agent did not add the experiment gate");
  if (fix && markerOnlyPatch(files.map((file) => file.patch), experiment.flag)) {
    await deleteBranch(repo, branch).catch(() => {});
    return recordNoChange(experiment, "the change only added Kismet's marker");
  }
  const changed = fix ? files.find((file) => file.patch) : files.find((file) => file.patch?.includes(gate));
  if (!changed) return failBuild(experiment, fix ? "the coding agent did not change any files" : "the gated file could not be found");
  const [draft, original] = await Promise.all([
    readFile(repo, changed.filename, branch),
    readFile(repo, changed.filename, base),
  ]);
  // The before/after copies only feed Kismet's preview; readFile skips large files, so a big file still
  // gets its pull request, just without the stored copies.
  const pull = await createPullFromBranch(
    repo, branch, base, experiment.kind === "fix" ? experiment.title : `Experiment: ${experiment.title}`,
    experiment.kind === "fix"
      ? fixPullBody(experiment, signal, agentReport)
      : pullBody(experiment, signal, experiment.treatment, files.some((file) => file.filename.endsWith(SERVER_SDK_FILE))),
  );
  await updateExperiment(experiment.id, {
    status: "awaiting_approval", prUrl: pull.url, prNumber: pull.number, branch,
    draftPath: changed.filename, draft: draft?.content ?? null, original: original?.content ?? null,
    note: `Built by ${by}. Waiting for the preview build.`,
  });
  await log("build", `Opened PR #${pull.number} for “${experiment.title}”.`, experiment.id);
  const summary = experiment.changeSummary;
  const codeIsLive = false;
  // Fixes get a sample render too, started now rather than when someone opens the page.
  if (summary?.kind === "ui" && (Boolean(summary.when.trim()) || !codeIsLive)) {
    await startSnapshot(
      { ...experiment, status: "awaiting_approval", prUrl: pull.url, prNumber: pull.number, branch },
      summary,
    ).catch((error) => console.error("[autopilot] could not start sample preview", error));
  }
  return `Opened a pull request for “${experiment.title}”.`;
}

async function followOne(experiment: Experiment, signal: Signal | undefined): Promise<string | null> {
  const sessionId = experiment.coderSessionId!;
  const view = await managedSessionView(sessionId);
  if (view.stopReason === "requires_action" && view.pendingApproval) {
    await client().beta.sessions.events.send(sessionId, { events: [{
      type: "user.tool_confirmation", tool_use_id: view.pendingApproval.toolUseId, result: "deny",
      deny_message: "Nobody is watching this build; skip steps that need approval and finish without them.",
    }] });
    await log("build", `Denied an unattended approval while building “${experiment.title}”.`, experiment.id);
    return null;
  }
  const steps = view.items.filter((item) => item.kind === "step").length;
  const stage = buildStage(view.items, { hasBranch: Boolean(view.branch) });
  const changed = stage !== experiment.buildStage || steps !== experiment.buildSteps;
  const now = new Date().toISOString();
  if (changed) {
    await updateExperiment(experiment.id, { buildStage: stage, buildSteps: steps, buildStageAt: now });
  }
  if (view.status === "running" || view.status === "rescheduling") {
    const decision = stallDecision({
      status: view.status,
      stageAt: changed ? now : experiment.buildStageAt,
      startedAt: experiment.buildStartedAt,
      attempts: experiment.buildAttempts,
      now,
    });
    if (decision === "ok") return null;
    if (decision === "give_up") {
      await client().beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] }).catch(() => {});
      await removePartialBranches(experiment, view.branch);
      return failBuild(experiment, "the coding agent stopped making progress");
    }
    const activityAt = changed ? now : experiment.buildStageAt ?? experiment.buildStartedAt ?? now;
    const inactiveMinutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(activityAt)) / 60_000));
    return restartBuild(
      experiment,
      signal,
      sessionId,
      view.branch,
      `Restarted the coding agent for “${experiment.title}”: no progress for ${inactiveMinutes} min.`,
    );
  }
  const said = [...view.items].reverse().find((item) => item.kind === "agent" && item.text);
  const agentReport = said?.kind === "agent" ? said.text : "";
  if (view.status === "idle" && view.stopReason === "end_turn" && view.branch) {
    return finishBuild(experiment, signal, view.branch, "Kismet's coding agent", agentReport);
  }
  const explanation = said && said.kind === "agent" ? said.text.split("\n").map((line) => line.trim()).find(Boolean)?.slice(0, 240) : "";
  const explicitNoChange = noChangeReason(agentReport);
  if (!view.branch && explicitNoChange) return recordNoChange(experiment, explicitNoChange);
  const reason = view.status === "terminated" ? "the coding session terminated" :
    view.stopReason === "budget_reached" ? "the coding session reached its budget" :
      view.branch ? "the coding session did not finish normally" :
        explanation || "the coding agent did not report a branch";
  const couldNotFindBug = /could not find|couldn't find|cannot find|no (?:real )?bug|could not reproduce|couldn't reproduce|cannot reproduce/i.test(agentReport);
  if (experiment.kind === "fix" && !view.branch && couldNotFindBug) {
    const note = `Could not find a real bug to fix: ${reason}`;
    await updateExperiment(experiment.id, { status: "failed", coderSessionId: null, agentFailed: true, endedAt: new Date().toISOString(), note });
    await setSignalStatus(experiment.signalId, "open");
    await snoozeSignal(experiment.signalId);
    await log("build", `${note}. Kismet will look again in 7 days.`, experiment.id);
    return note;
  }
  if (!view.branch && experiment.buildAttempts < MAX_ATTEMPTS) {
    return restartBuild(
      experiment,
      signal,
      sessionId,
      null,
      `Restarted the coding agent for “${experiment.title}”: the session ended without a branch.`,
    );
  }
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
  const branches = buildBranches(experiment, branch);
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
