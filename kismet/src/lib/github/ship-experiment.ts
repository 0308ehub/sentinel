import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { GitHubApiError, listUiFiles, openPullRequest, readFile, repoDefaultBranch } from "@/lib/github/client";

export interface ExperimentBrief {
  title: string;
  hypothesis: string;
  metric: string;
  control: string;
  treatment: string;
  guardrail: string;
}

interface DraftFile {
  path?: string;
  content?: string;
  summary?: string;
}

export async function shipExperimentPullRequest(fullName: string, brief: ExperimentBrief) {
  const base = await repoDefaultBranch(fullName);
  const paths = await listUiFiles(fullName, base);
  const files = [];
  for (const path of paths) {
    if (files.length >= 4) break;
    const file = await readFile(fullName, path, base).catch(() => null);
    if (file) files.push(file);
  }
  if (files.length === 0) {
    throw new GitHubApiError(
      "no_ui",
      "This repository has no small page or component file Kismet can edit. Fork a small Next.js app, such as nextjs/saas-starter, into your account.",
      422
    );
  }

  const flag = `kismet-${slug(brief.title)}`;
  const text = await askForJson(
    [
      "Edit one existing file so an experiment can ship behind a flag.",
      "Return JSON with path, content, and summary.",
      "path must be one of the files provided. content is the full file after a small change.",
      "The treatment is visible only when process.env.NEXT_PUBLIC_KISMET_EXPERIMENT equals the flag.",
      "Add data-kismet-experiment on the changed element, set to the flag.",
      "Keep the rest of the file. Match its existing components and style.",
      "Do not add a measured result, a percentage, or a claim that the experiment won.",
      `Flag: ${flag}`,
    ].join(" "),
    [
      `Title: ${brief.title}`,
      `Hypothesis: ${brief.hypothesis}`,
      `Control: ${brief.control}`,
      `Treatment: ${brief.treatment}`,
      `Metric: ${brief.metric}`,
      `Guardrail: ${brief.guardrail}`,
      "",
      ...files.map((file) => `FILE ${file.path}\n${file.content}`),
    ].join("\n"),
    false,
    undefined,
    "experiment"
  );
  const draft = readJson<DraftFile>(text);
  const original = files.find((file) => file.path === draft.path?.trim());
  const content = draft.content?.replace(/\r\n/g, "\n");
  if (!original || !content || content === original.content) {
    throw new GitHubApiError("empty_change", "The draft did not change one of the files Kismet read.", 502);
  }
  if (content.length > 80_000) {
    throw new GitHubApiError("too_large", "The edited file is too large to commit.", 422);
  }

  const branch = `${flag}-${Date.now().toString(36).slice(-4)}`;
  const summary = draft.summary?.trim().slice(0, 280) || brief.treatment || brief.title;
  const pull = await openPullRequest({
    fullName,
    base,
    branch,
    path: original.path,
    content,
    sha: original.sha,
    title: `Experiment: ${brief.title}`.slice(0, 120),
    message: `Experiment: ${brief.title}`,
    body: [
      `## ${brief.title}`,
      "",
      brief.hypothesis,
      "",
      `**Control:** ${brief.control || "The current screen."}`,
      `**Treatment:** ${brief.treatment || summary}`,
      `**Metric:** ${brief.metric || "Not chosen."}`,
      `**Guardrail:** ${brief.guardrail || "Not chosen."}`,
      "",
      `The change is in \`${original.path}\` and stays off unless \`NEXT_PUBLIC_KISMET_EXPERIMENT\` is \`${flag}\`.`,
      "The changed element is marked with `data-kismet-experiment` so exposure can be counted later.",
      "",
      "Kismet has not measured this. A readout needs the flag on in a running app, and events for that flag.",
    ].join("\n"),
  });
  return { ...pull, flag, summary, path: original.path };
}

function slug(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return clean || "experiment";
}
