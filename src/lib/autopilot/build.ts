import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { autopilotDryRun, autopilotRepo } from "@/lib/autopilot/repo";
import { listExperiments, listSignals, log, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { lockedFiles } from "@/lib/autopilot/overlap";
import { baseBranch, isLocalSource, listSourceFiles, readSourceFile } from "@/lib/autopilot/source";
import { closePull, commitChecks, getPull, GitHubApiError, openPullRequest, type GitHubFile } from "@/lib/github/client";

const IMPORT_LINE = 'import { useVariant } from "@/lib/autopilot/variant";';

function codeRules(flag: string): string {
  return [
    `Gate the new version with the hook: ${IMPORT_LINE}`,
    `const variant = useVariant("${flag}"); render the change only when variant === "treatment".`,
    "Control must render exactly what it renders today.",
    "The file must start with \"use client\" and the hook must be called at the top level of a component, never conditionally.",
    "The change must appear only where the experiment says, never on other pages: no global or fixed-position elements.",
    "Use only components and imports that already exist in the file or in the files shown. Match the existing style.",
    `Add data-track="${flag}" to the new element.`,
    "Do not invent data, results or claims.",
  ].join(" ");
}

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

async function writeChange(experiment: Experiment, files: GitHubFile[]): Promise<{ file: GitHubFile; content: string; summary: string }> {
  const locked = await lockedFiles(experiment.id);
  // Never two experiments in one file: the code would collide, and so would their cleanups. If the
  // file this change belongs in is taken, wait for it rather than forcing the change somewhere else.
  const primary = files[0];
  const holder = primary ? locked.get(primary.path) : undefined;
  if (holder) throw new FileBusy(`Waiting for “${holder.title}” to finish: it changes ${primary.path}, which this needs too.`);
  const editable = files.filter((f) => /^\s*["']use client["']/.test(f.content) && !locked.has(f.path));
  if (editable.length === 0) throw new Error("None of the relevant files is a client component Autopilot can edit.");
  const text = await askForJson(
    [
      "Edit exactly one file to add an A/B experiment. Return JSON {path, content, summary}.",
      "path must be one of the files marked EDITABLE. content is the full new file. summary is one sentence for the pull request.",
      codeRules(experiment.flag),
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
  if (!content.includes(`useVariant("${experiment.flag}")`) || !content.includes("@/lib/autopilot/variant")) {
    throw new Error("The draft did not gate the change behind its experiment flag.");
  }
  if (content.length > 80_000) throw new Error("The edited file is too large.");
  return { file, content, summary: draft.summary?.trim().slice(0, 280) || experiment.treatment };
}

function pullBody(experiment: Experiment, signal: Signal | undefined, summary: string): string {
  const evidence = signal?.evidence ?? [];
  const synthetic = evidence.filter((e) => e.synthetic).length;
  return [
    `## ${experiment.title}`,
    "",
    summary,
    "",
    `**Hypothesis:** ${experiment.hypothesis}`,
    `**Control:** ${experiment.control || "Today's screen."}`,
    `**Treatment:** ${experiment.treatment}`,
    `**Measured by:** ${experiment.metric}`,
    experiment.guardrail ? `**Guardrail:** ${experiment.guardrail}` : "",
    "",
    `### Why (${evidence.length} pieces of evidence${synthetic ? `, ${synthetic} synthetic` : ""})`,
    ...evidence.slice(0, 8).map((e) => `- ${e.synthetic ? "_(synthetic)_ " : ""}[${e.source}] ${e.title}`),
    "",
    `The change is dark until Autopilot starts the experiment (flag \`${experiment.flag}\`, 50/50 split).`,
    "Approve it from Kismet's Autopilot page, or merge this PR — merging is the approval.",
    "",
    "_Opened by Kismet Autopilot._",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Writes the code change for one designed experiment and opens its pull request. */
export async function buildNext(): Promise<string | null> {
  const experiments = await listExperiments();
  const experiment = experiments.find((e) => e.status === "building" && !e.prNumber);
  if (!experiment) return null;
  const signal = (await listSignals()).find((s) => s.id === experiment.signalId);
  const repo = autopilotRepo();

  try {
    const base = await baseBranch();
    const files = await pickFiles(base, experiment, signal);
    if (files.length === 0) throw new Error("Could not find the files for this change.");
    const change = await writeChange(experiment, files);
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
      title: `Experiment: ${experiment.title}`,
      message: `Experiment: ${experiment.title}`,
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
  const repo = autopilotRepo();
  const waiting = (await listExperiments()).filter((e) => e.status === "awaiting_approval" && e.prNumber);
  const done: string[] = [];
  for (const experiment of waiting) {
    const pull = await getPull(repo, experiment.prNumber!);
    if (pull.merged) {
      await start(experiment);
      done.push(`Started “${experiment.title}” (merged on GitHub).`);
      continue;
    }
    if (pull.state === "closed") {
      await updateExperiment(experiment.id, { status: "rejected", endedAt: new Date().toISOString(), note: "Closed on GitHub." });
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
        note: "The preview build failed, so Autopilot closed the PR and will try another version.",
      });
      await setSignalStatus(experiment.signalId, "open");
      await log("build", `Preview build failed for “${experiment.title}”; closed PR #${experiment.prNumber}.`, experiment.id);
    } else if (checks === "success" && !experiment.note?.includes("Preview build passed")) {
      await updateExperiment(experiment.id, { note: `${(experiment.note ?? "").replace(" Waiting for the preview build.", "")} Preview build passed.`.trim() });
    }
  }
  return done.length ? done.join(" ") : null;
}
