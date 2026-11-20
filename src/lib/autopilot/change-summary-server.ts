import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { fallbackSummary, patchDigest, type ChangeFile, type ChangeSummary } from "@/lib/autopilot/change-summary";
import { unifiedDiff } from "@/lib/autopilot/diff";
import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { experimentDraft, setExperimentChangeSummary } from "@/lib/autopilot/store";
import type { Experiment } from "@/lib/autopilot/types";
import { compareFiles, pullChanges, repoDefaultBranch } from "@/lib/github/client";

type ModelSummary = Pick<ChangeSummary, "kind" | "before" | "after" | "where" | "when">;

function validSummary(value: ModelSummary): boolean {
  return (value.kind === "ui" || value.kind === "behavior")
    && [value.before, value.after, value.where, value.when].every((item) => typeof item === "string");
}

/** Creates and persists the product-facing summary once code exists. */
export async function ensureChangeSummary(experiment: Experiment): Promise<ChangeSummary | null> {
  if (experiment.changeSummary) return experiment.changeSummary;
  const repo = await chosenAutopilotRepo();
  let files: ChangeFile[] = [];
  if (experiment.prNumber && repo) {
    files = (await pullChanges(repo, experiment.prNumber)).files;
  } else if (experiment.branch && repo) {
    files = await compareFiles(repo, await repoDefaultBranch(repo), experiment.branch);
  } else {
    const draft = await experimentDraft(experiment.id);
    if (draft) files = [{ filename: draft.path, patch: unifiedDiff(draft.path, draft.original ?? "", draft.content) }];
  }
  if (files.length === 0) return null;

  let summary = fallbackSummary(experiment, files);
  try {
    const answer = readJson<ModelSummary>(await askForJson(
      [
        "Explain a product code change in plain language a product manager understands.",
        "Describe what people SEE for UI changes, or what they GET or EXPERIENCE for behavior changes.",
        "Return JSON only: {kind, before, after, where, when}.",
        "kind is ui or behavior. before and after are one or two sentences each.",
        "where is the route, path, or product place. when is any extra condition for it to appear beyond being in the new version of the experiment (for example only when a list is empty, or only for new accounts); use an empty string when there is none. Never mention variants, treatment, or the experiment split.",
      ].join(" "),
      `EXPERIMENT\nTitle: ${experiment.title}\nControl: ${experiment.control}\nTreatment: ${experiment.treatment}\nPage: ${experiment.page}\n\nPATCHES\n${patchDigest(files, 12_000)}`,
      false,
      undefined,
      "experiment",
    ));
    if (!validSummary(answer)) throw new Error("Invalid summary response.");
    summary = { ...answer, at: new Date().toISOString() };
  } catch (error) {
    console.error("[autopilot] change summary fallback", error);
  }
  await setExperimentChangeSummary(experiment.id, summary);
  return summary;
}
