import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { changeTitle, codeRules, fixMark, fixRules, pullBody } from "@/lib/autopilot/agent-task";
import { agentBuildAvailable, startAgentBuild } from "@/lib/autopilot/agent-build";
import { accountBuilder } from "@/lib/autopilot/builder-store";
import { startDispatchBuild } from "@/lib/autopilot/dispatch-build";
import { autopilotDryRun, autopilotRepo, defaultAutopilotRepo } from "@/lib/autopilot/repo";
import { listExperiments, listSignals, log, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { lockedFiles } from "@/lib/autopilot/overlap";
import { baseBranch, isLocalSource, listSourceFiles, readSourceFile } from "@/lib/autopilot/source";
import { closePull, commitChecks, getPull, GitHubApiError, openPullRequest, type GitHubFile } from "@/lib/github/client";

async function pickFiles(base: string, experiment: Experiment, signal: Signal | undefined): Promise<GitHubFile[]> {
  const paths = await listSourceFiles(base, 600);
  const text = await askForJson(
    'Choose the files to read to make this UI change. The first path must be the file the change belongs in: the page or component that renders that part of the screen. Return JSON {"paths":[up to 3 paths from the list, that file first]}.',
    [
      `CHANGE: ${experiment.treatment}`,
      `PAGE: ${experiment.page}`,
      `AREA: ${signal?.area ?? ""}`,
      `PROBLEM: ${signal?.title ?? ""}`,
      "FILES",
      ...paths,
    ].join("\n"),
    false,
    undefined,
    "experiment"
  );
  const chosen = (readJson<{ paths?: string[] }>(text).paths ?? []).filter((p) => paths.includes(p)).slice(0, 3);
  const files: GitHubFile[] = [];
  for (const path of chosen) {
    const file = await readSourceFile(path, base).catch(() => null);
    if (file) files.push(file);
  }
  return files;
}

/** Raised when the only files this change could edit are in use by another experiment. */
class FileBusy extends Error {}

async function writeChange(
  experiment: Experiment,
  files: GitHubFile[],
  external: boolean
): Promise<{ file: GitHubFile; content: string; summary: string }> {
  const locked = await lockedFiles(experiment.id);
  // Never two experiments in one file: the code would collide, and so would their cleanups. If the
  // file this change belongs in is taken, wait for it rather than forcing the change somewhere else.
  const primary = files[0];
  const holder = primary ? locked.get(primary.path) : undefined;
  if (holder) throw new FileBusy(`Waiting for “${holder.title}” to finish: it changes ${primary.path}, which this needs too.`);
  const editable = files.filter((f) => /^\s*["']use client["']/.test(f.content) && !locked.has(f.path));
  if (editable.length === 0) throw new Error("None of the relevant files is a client component Kismet can edit.");
  const fix = experiment.kind === "fix";
  const text = await askForJson(
    [
      fix
        ? "Edit exactly one file to apply a quick fix that everyone should see. Return JSON {path, content, summary}."
        : "Edit exactly one file to add an A/B experiment. Return JSON {path, content, summary}.",
      "path must be one of the files marked EDITABLE. content is the full new file. summary is one sentence for the pull request.",
      fix ? fixRules(experiment.flag) : codeRules(experiment.flag, external),
    ].join(" "),
    [
      `EXPERIMENT: ${experiment.title}`,
      `PAGE: ${experiment.page}`,
      `HYPOTHESIS: ${experiment.hypothesis}`,
      `CONTROL: ${experiment.control}`,
      `TREATMENT: ${experiment.treatment}`,
      `METRIC: ${experiment.metric}`,
      "",
      ...files.map((f) => `FILE ${f.path}${editable.includes(f) ? " (EDITABLE)" : " (reference only)"}\n${f.content}`),
    ].join("\n"),
    false,
    undefined,
    "experiment"
  );
  const draft = readJson<{ path?: string; content?: string; summary?: string }>(text);
  const file = editable.find((f) => f.path === draft.path?.trim());
  const content = draft.content?.replace(/\r\n/g, "\n");
  if (!file || !content || content === file.content) throw new Error("The draft did not change an editable file.");
  const gated = fix
    ? content.includes(fixMark(experiment.flag))
    : external
      ? content.includes(`kismet.variant("${experiment.flag}")`)
      : content.includes(`useVariant("${experiment.flag}")`) && content.includes("@/lib/autopilot/variant");
  if (!gated) {
    throw new Error(fix ? "The draft did not mark the quick fix." : "The draft did not gate the change behind its experiment flag.");
  }
  if (content.length > 80_000) throw new Error("The edited file is too large.");
  return { file, content, summary: draft.summary?.trim().slice(0, 280) || experiment.treatment };
}

/** Writes the code change for one designed experiment and opens its pull request. */
export async function buildNext(): Promise<string | null> {
  const experiments = await listExperiments();
  // An experiment a coding agent is already building is followed by followAgentBuilds or
  // followDispatchBuilds, never restarted here.
  const experiment = experiments.find((e) => e.status === "building" && !e.prNumber && !e.coderSessionId && !e.buildRef);
  if (!experiment) return null;
  const signal = (await listSignals()).find((s) => s.id === experiment.signalId);
  const repo = await autopilotRepo();

  if (experiment.agentFailed) {
    await updateExperiment(experiment.id, {
      status: "failed",
      endedAt: new Date().toISOString(),
      note: experiment.note ?? "The coding agent did not ship a change.",
    });
    await setSignalStatus(experiment.signalId, "open");
    return `Stopped “${experiment.title}”. The coding agent did not ship a change.`;
  }
  // A choice on this experiment wins. Otherwise the account's default agent writes it.
  const builder = experiment.buildWith ?? (await accountBuilder());
  if (builder !== "kismet" && !autopilotDryRun() && !isLocalSource()) return startDispatchBuild(experiment, signal, builder);
  if (experiment.kind === "fix") {
    if (await agentBuildAvailable()) return startAgentBuild(experiment, signal);
    await updateExperiment(experiment.id, { note: "A coding agent is required to build this fix." });
    return null;
  }
  if (await agentBuildAvailable()) return startAgentBuild(experiment, signal);

  try {
    const base = await baseBranch();
    const files = await pickFiles(base, experiment, signal);
    if (files.length === 0) throw new Error("Could not find the files for this change.");
    const change = await writeChange(experiment, files, repo !== defaultAutopilotRepo());
    if (autopilotDryRun() || isLocalSource()) {
      await updateExperiment(experiment.id, {
        status: "awaiting_approval",
        overlap: null,
        draftPath: change.file.path,
        draft: change.content,
        original: change.file.content,
        note: `Dry run: changes ${change.file.path}. Nothing was pushed to GitHub.`,
      });
      await log("build", `Wrote the change for “${experiment.title}” (dry run, not pushed).`, experiment.id);
      return `Wrote the change for “${experiment.title}” (dry run).`;
    }
    const pull = await openPullRequest({
      fullName: repo,
      base,
      branch: `autopilot/${experiment.flag}`,
      path: change.file.path,
      content: change.content,
      sha: change.file.sha,
      title: changeTitle(experiment),
      message: changeTitle(experiment),
      body: pullBody(experiment, signal, change.summary),
    });
    await updateExperiment(experiment.id, {
      status: "awaiting_approval",
      draftPath: change.file.path,
      draft: change.content,
      original: change.file.content,
      prUrl: pull.url,
      prNumber: pull.number,
      branch: pull.branch,
      note: `Changes ${change.file.path}. Waiting for the preview build.`,
    });
    await log("build", `Opened PR #${pull.number} for “${experiment.title}”.`, experiment.id);
    return `Opened a pull request for “${experiment.title}”.`;
  } catch (error) {
    if (error instanceof FileBusy) {
      await updateExperiment(experiment.id, { overlap: error.message, note: null });
      return null;
    }
    const hint = error instanceof GitHubApiError ? error.hint ?? error.message : error instanceof Error ? error.message : String(error);
    await updateExperiment(experiment.id, { note: `Could not build yet: ${hint}` });
    throw new Error(hint);
  }
}

/** Follows open pull requests: preview build results, and merges or closes done on GitHub directly. */
export async function followPulls(start: (experiment: Experiment) => Promise<unknown>): Promise<string | null> {
  if (autopilotDryRun() || isLocalSource()) return null;
  const repo = await autopilotRepo();
  const waiting = (await listExperiments()).filter((e) => e.status === "awaiting_approval" && e.prNumber);
  const done: string[] = [];
  for (const experiment of waiting) {
    const pull = await getPull(repo, experiment.prNumber!);
    if (pull.merged) {
      await start(experiment);
      done.push(experiment.kind === "fix" ? `Merged “${experiment.title}” on GitHub; watching for complaints.` : `Started “${experiment.title}” (merged on GitHub).`);
      continue;
    }
    if (pull.state === "closed") {
      await updateExperiment(experiment.id, { status: "rejected", rejectedBy: "person", endedAt: new Date().toISOString(), note: "Closed on GitHub." });
      await setSignalStatus(experiment.signalId, "open");
      await log("gate", `“${experiment.title}” was closed on GitHub.`, experiment.id);
      continue;
    }
    const checks = await commitChecks(repo, pull.headSha);
    if (checks === "failure") {
      await closePull(repo, experiment.prNumber!);
      await updateExperiment(experiment.id, {
        status: "failed",
        endedAt: new Date().toISOString(),
        note: "The preview build failed, so Kismet closed the PR and will try another version.",
      });
      await setSignalStatus(experiment.signalId, "open");
      await log("build", `Preview build failed for “${experiment.title}”; closed PR #${experiment.prNumber}.`, experiment.id);
    } else if (checks === "success" && !experiment.note?.includes("Preview build passed")) {
      await updateExperiment(experiment.id, { note: `${(experiment.note ?? "").replace(" Waiting for the preview build.", "")} Preview build passed.`.trim() });
    }
  }
  return done.length ? done.join(" ") : null;
}
