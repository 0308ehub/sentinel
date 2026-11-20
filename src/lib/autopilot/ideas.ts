import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { autopilotRepo } from "@/lib/autopilot/repo";
import { autopilotUser } from "@/lib/autopilot/scope";
import {
  addEvidenceWithIds,
  assignEvidence,
  createSignal,
  interviewContext,
  kismetIdeasToday,
  listExperiments,
  listGoals,
  listLearnings,
  listRatings,
  listSignals,
  log,
  popularUsage,
  recentJourneys,
  setSignalTriage,
} from "@/lib/autopilot/store";
import { buildThemes } from "@/lib/autopilot/themes";
import { buildIdeasInput, dedupeIdeas, ideasInstructions, parseIdeasResponse } from "@/lib/autopilot/ideas-core";
import { listUiFiles, repoDefaultBranch } from "@/lib/github/client";
import { readWorkspaceNotes } from "@/lib/workspace/cloud";

export interface IdeaResult {
  signalIds: string[];
  message: string | null;
}

async function uiFiles(): Promise<string[]> {
  try {
    const repo = await autopilotRepo();
    return listUiFiles(repo, await repoDefaultBranch(repo), 40);
  } catch {
    return [];
  }
}

export async function suggestIdeas(): Promise<IdeaResult> {
  const usedToday = await kismetIdeasToday();
  if (usedToday >= 6) {
    return { signalIds: [], message: "Kismet has reached today's limit of 6 product ideas." };
  }

  const [goals, learnings, signals, experiments, ratings, journeys, usage, interviews, notes, files] = await Promise.all([
    listGoals(),
    listLearnings(),
    listSignals(),
    listExperiments(),
    listRatings(),
    recentJourneys(),
    popularUsage(),
    interviewContext(),
    readWorkspaceNotes(autopilotUser()).then((items) => items ?? []),
    uiFiles(),
  ]);
  const thumbsDown = ratings.filter((rating) => rating.rating === "not_useful").map((rating) => rating.title);
  const existingTitles = [
    ...signals.map((signal) => signal.title),
    ...experiments.map((experiment) => experiment.title),
    ...thumbsDown,
  ];
  const input = buildIdeasInput({
    goals: goals.map((goal) => ({ name: goal.name, metric: goal.spec, baselineRate: goal.baselineRate })),
    learnings: learnings.map((learning) => ({ title: learning.title, outcome: learning.outcome, page: learning.page, learning: learning.learning })),
    themes: buildThemes(signals, new Date()).map((theme) => ({ title: theme.title, problem: theme.problem, mentions: theme.mentions, trend: theme.trend })),
    signals: signals.map((signal) => ({ title: signal.title, status: signal.status, area: signal.area })),
    experiments: experiments.map((experiment) => ({ title: experiment.title, status: experiment.status, page: experiment.page })),
    thumbsDown,
    journeys,
    usage,
    interviews: interviews.map((item) => ({ title: item.title, body: item.body })),
    notes: notes.map((note) => ({ title: note.title, body: note.body })),
    uiFiles: files,
  });
  const response = await askForJson(ideasInstructions(), input, false, undefined, "experiment");
  const ideas = dedupeIdeas(parseIdeasResponse(readJson<unknown>(response)), existingTitles).slice(0, 6 - usedToday);
  const signalIds: string[] = [];
  const now = new Date().toISOString();

  for (const idea of ideas) {
    const signalId = await createSignal({ title: idea.title, problem: idea.problem, area: idea.page });
    const evidenceIds = await addEvidenceWithIds([{
      source: "kismet",
      synthetic: false,
      title: idea.title,
      body: `${idea.why}\n\nBased on: ${idea.basis.join(", ")}`,
      author: "Kismet",
      url: `kismet://idea/${signalId}`,
      occurredAt: now,
    }]);
    await assignEvidence(signalId, evidenceIds);
    await setSignalTriage(signalId, "idea", "Kismet's own idea from what it knows about the product");
    await log("suggest", `Suggested “${idea.title}”`, signalId);
    signalIds.push(signalId);
  }

  return {
    signalIds,
    message: signalIds.length
      ? `Suggested ${signalIds.length} product idea${signalIds.length === 1 ? "" : "s"}.`
      : "Kismet did not find a distinct product idea this time.",
  };
}
