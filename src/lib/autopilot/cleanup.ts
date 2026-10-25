import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { autopilotDryRun, autopilotRepo } from "@/lib/autopilot/repo";
import { baseBranch, isLocalSource, readSourceFile } from "@/lib/autopilot/source";
import { experimentDraft, listExperiments, log, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";
import { closePull, commitChecks, getPull, GitHubApiError, mergePull, openPullRequest } from "@/lib/github/client";

// Once an experiment is decided, its switch is dead code: everyone sees the winner (rolled out) or
// the original (turned off). Cleanup removes the switch and the losing version so the codebase
// keeps only what users actually get. It changes production code, so it waits for approval like
// every other ship, but it never changes what anyone sees.

const IMPORT_PATH = "@/lib/autopilot/variant";

const simulated = () => autopilotDryRun() || isLocalSource();

/** The experiment's code reached the product, so there is a switch to remove. */
function needsCleanup(experiment: Experiment): boolean {
  if (experiment.cleanup && experiment.cleanup.status !== "building") return false;
  // "stopped" only follows an approval (a running, winning or queued experiment), so its code shipped.
  if (!experiment.draftPath) return false;
  if (experiment.status !== "rolled_out" && experiment.status !== "stopped") return false;
  return simulated() || experiment.prNumber != null;
}

function keepFor(experiment: Experiment): "control" | "treatment" {
  return experiment.status === "rolled_out" ? "treatment" : "control";
}

async function currentFile(experiment: Experiment): Promise<{ path: string; content: string; sha: string } | null> {
  if (simulated()) {
    const draft = await experimentDraft(experiment.id);
    return draft ? { path: draft.path, content: draft.content, sha: "local" } : null;
  }
  const file = await readSourceFile(experiment.draftPath!, await baseBranch());
  return file ? { path: file.path, content: file.content, sha: file.sha } : null;
}

async function writeCleanup(experiment: Experiment, file: { path: string; content: string }): Promise<string> {
  const keep = keepFor(experiment);
  const stored = await experimentDraft(experiment.id);

  // Turned off and nobody has touched the file since: put back exactly what was there before.
  if (keep === "control" && stored?.original && stored.content === file.content) return stored.original;

  const reference =
    keep === "control" && stored?.original
      ? `\n\nBEFORE THE EXPERIMENT (restore the parts the experiment changed to exactly this; keep unrelated later edits)\n${stored.original}`
      : "";
  const text = await askForJson(
    [
      `Remove the finished A/B experiment "${experiment.flag}" from this file. Return JSON {content}: the full new file.`,
      keep === "treatment"
        ? 'Keep what renders when the variant is "treatment", unconditionally, and delete what only rendered for "control".'
        : 'Delete everything the experiment added, so the file renders exactly what it did before the experiment.',
      `Delete the useVariant("${experiment.flag}") call, the variable holding it, and data-track="${experiment.flag}".`,
      `Remove the import from "${IMPORT_PATH}" if nothing else in the file uses useVariant. Remove other imports that become unused.`,
      "Change nothing else in the file.",
    ].join(" "),
    `FILE ${file.path}\n${file.content}${reference}`,
    false,
    undefined,
    "experiment"
  );
  const content = readJson<{ content?: string }>(text).content?.replace(/\r\n/g, "\n");
  if (!content || content === file.content) throw new Error("The cleanup did not change the file.");
  if (content.includes(experiment.flag)) throw new Error("The cleanup left the experiment switch in the file.");
  const stillUsed = /useVariant\(/.test(content);
  if (!stillUsed && content.includes(IMPORT_PATH)) throw new Error("The cleanup left an unused useVariant import.");
  if (stillUsed && !content.includes(IMPORT_PATH)) throw new Error("The cleanup removed an import another experiment still needs.");
  return content;
}

/** Writes the cleanup for one decided experiment and opens its pull request. */
export async function buildCleanup(): Promise<string | null> {
  const experiment = (await listExperiments()).find(needsCleanup);
  if (!experiment) return null;
  const keep = keepFor(experiment);
  const kept = keep === "treatment" ? "the new version" : "the original version";
  await updateExperiment(experiment.id, { cleanupStatus: "building" });

  try {
    const file = await currentFile(experiment);
    if (!file || !file.content.includes(experiment.flag)) {
      await updateExperiment(experiment.id, { cleanupStatus: "merged", cleanupNote: "The experiment switch is already gone from the code." });
      return null;
    }
    const content = await writeCleanup(experiment, file);

    if (simulated()) {
      await updateExperiment(experiment.id, {
        cleanupStatus: "awaiting",
        cleanupDraft: content,
        cleanupNote: `Dry run: keeps ${kept} in ${file.path} and removes the switch. Nothing was pushed.`,
      });
      await log("cleanup", `Wrote the cleanup for “${experiment.title}” (dry run).`, experiment.id);
      return `Wrote the cleanup for “${experiment.title}” (dry run).`;
    }

    const pull = await openPullRequest({
      fullName: autopilotRepo(),
      base: await baseBranch(),
      branch: `autopilot/${experiment.flag}-cleanup`,
      path: file.path,
      content,
      sha: file.sha,
      title: `Finish experiment: ${experiment.title}`,
      message: `Finish experiment: ${experiment.title}`,
      body: [
        `## Finish experiment: ${experiment.title}`,
        "",
        experiment.note ?? "",
        "",
        `Keeps ${kept} and removes the \`${experiment.flag}\` switch from \`${file.path}\`.`,
        `Everyone already sees ${kept}, so merging this changes no one's experience.`,
        "",
        "_Opened by Kismet Autopilot._",
      ].join("\n"),
    });
    await updateExperiment(experiment.id, {
      cleanupStatus: "awaiting",
      cleanupPrUrl: pull.url,
      cleanupPrNumber: pull.number,
      cleanupDraft: content,
      cleanupNote: `Keeps ${kept} in ${file.path}. Waiting for the preview build.`,
    });
    await log("cleanup", `Opened PR #${pull.number} to remove the switch for “${experiment.title}”.`, experiment.id);
    return `Opened a cleanup pull request for “${experiment.title}”.`;
  } catch (error) {
    const hint = error instanceof GitHubApiError ? error.hint ?? error.message : error instanceof Error ? error.message : String(error);
    await updateExperiment(experiment.id, { cleanupNote: `Could not write the cleanup yet: ${hint}` });
    throw new Error(hint);
  }
}

export async function approveCleanup(experiment: Experiment): Promise<string> {
  if (experiment.cleanup?.status !== "awaiting") throw new Error("There is no cleanup waiting for approval.");
  if (!experiment.cleanup.prNumber) {
    await updateExperiment(experiment.id, { cleanupStatus: "merged", cleanupNote: "Dry run: approved, nothing was merged." });
    await log("cleanup", `Approved the cleanup for “${experiment.title}” (dry run).`, experiment.id);
    return "Approved (dry run: nothing was merged).";
  }
  await mergePull(autopilotRepo(), experiment.cleanup.prNumber, `Finish experiment: ${experiment.title}`);
  await updateExperiment(experiment.id, { cleanupStatus: "merged", cleanupNote: "Merged. The experiment switch is gone." });
  await log("cleanup", `Merged the cleanup for “${experiment.title}”.`, experiment.id);
  return "Merged. The experiment code is cleaned up.";
}

export async function dismissCleanup(experiment: Experiment): Promise<string> {
  if (experiment.cleanup?.status !== "awaiting") throw new Error("There is no cleanup waiting for approval.");
  if (experiment.cleanup.prNumber) await closePull(autopilotRepo(), experiment.cleanup.prNumber).catch(() => {});
  await updateExperiment(experiment.id, { cleanupStatus: "closed", cleanupNote: "Dismissed by you. The switch stays in the code." });
  await log("cleanup", `You dismissed the cleanup for “${experiment.title}”.`, experiment.id);
  return "Dismissed. The experiment switch stays in the code.";
}

/** Follows cleanup pull requests the same way experiment PRs are followed. */
export async function followCleanups(): Promise<string | null> {
  if (simulated()) return null;
  const repo = autopilotRepo();
  const waiting = (await listExperiments()).filter((e) => e.cleanup?.status === "awaiting" && e.cleanup.prNumber);
  const done: string[] = [];
  for (const experiment of waiting) {
    const number = experiment.cleanup!.prNumber!;
    const pull = await getPull(repo, number);
    if (pull.merged) {
      await updateExperiment(experiment.id, { cleanupStatus: "merged", cleanupNote: "Merged on GitHub. The experiment switch is gone." });
      done.push(`Cleanup for “${experiment.title}” was merged.`);
    } else if (pull.state === "closed") {
      await updateExperiment(experiment.id, { cleanupStatus: "closed", cleanupNote: "Closed on GitHub. The switch stays in the code." });
    } else if ((await commitChecks(repo, pull.headSha)) === "failure") {
      await closePull(repo, number);
      await updateExperiment(experiment.id, {
        cleanupStatus: "failed",
        cleanupNote: "The cleanup's preview build failed, so Autopilot closed it. The switch stays in the code.",
      });
      await log("cleanup", `Cleanup build failed for “${experiment.title}”; closed PR #${number}.`, experiment.id);
    }
  }
  return done.length ? done.join(" ") : null;
}
