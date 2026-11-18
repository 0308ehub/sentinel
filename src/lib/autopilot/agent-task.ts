interface TaskExperiment {
  flag: string;
  title: string;
  hypothesis: string;
  page: string;
  control: string;
  treatment: string;
  metric: string;
  guardrail: string;
}

interface TaskSignal {
  title: string;
  problem: string;
  evidence: { title: string; source?: string; synthetic?: boolean }[];
}

function fixBranch(flag: string): string {
  return `kismet/${flag.replace(/-v\d+$/, "")}`;
}

export function fixTask(experiment: TaskExperiment, signal: TaskSignal | undefined): string {
  const branch = fixBranch(experiment.flag);
  const complaints = signal?.evidence.slice(0, 8).map((item) => `- [${item.source ?? "unknown"}] ${item.title}`) ?? [];
  return [
    "Fix this reported bug in the repository at /workspace/repo.",
    `BUG: ${signal?.title ?? experiment.title} — ${signal?.problem ?? experiment.hypothesis}`,
    complaints.length ? `COMPLAINTS:\n${complaints.join("\n")}` : "",
    `AREA/PAGE: ${experiment.page}`,
    `BROKEN BEHAVIOR: ${experiment.control}`,
    `INTENDED FIX: ${experiment.treatment}`,
    "Reproduce or locate the bug by reading the code and cite the relevant path:line in your final response. Make the smallest correct fix of the root cause.",
    "Add or update a test when the repository has tests nearby. Run the project's relevant checks. Never add a feature flag, variant, experiment gate, or A/B test.",
    `Work on branch ${branch} from the default branch. Never touch unrelated code. Commit and push the change, but do not open or merge a pull request.`,
    "If you cannot find a real bug supported by the complaints, say so plainly and do not push a branch.",
    `If you pushed the fix, end your final response with exactly: BRANCH: ${branch}`,
  ].filter(Boolean).join("\n\n");
}

export function codeRules(flag: string, external: boolean): string {
  if (external) {
    return [
      "Gate the new version with a small local React hook in the edited file.",
      'It must default to useState("control") and, after mount, read const kismet = window.kismet; if it is missing, return.',
      "When it exists, call",
      `kismet.ready.then(() => setVariant(kismet.variant("${flag}"))).`,
      "For a TypeScript file, add declare global with an optional Window.kismet whose ready is Promise<void> and whose",
      'variant(flag: string) returns "control" or "treatment".',
      "Control must render exactly what it renders today, including during server rendering and hydration.",
      "The hook must be called at the top level of a client component, never conditionally.",
      "The change must appear only where the experiment says, never on other pages: no global or fixed-position elements.",
      "Use only components and imports that already exist in the file or React hooks. Match the existing style.",
      `Add data-track="${flag}" to the new element.`,
      "Do not invent data, results or claims.",
    ].join(" ");
  }
  return [
    'Gate the new version with the hook: import { useVariant } from "@/lib/autopilot/variant";',
    `const variant = useVariant("${flag}"); render the change only when variant === "treatment".`,
    "Control must render exactly what it renders today.",
    'The file must start with "use client" and the hook must be called at the top level of a component, never conditionally.',
    "The change must appear only where the experiment says, never on other pages: no global or fixed-position elements.",
    "Use only components and imports that already exist in the file or in the files shown. Match the existing style.",
    `Add data-track="${flag}" to the new element.`,
    "Do not invent data, results or claims.",
  ].join(" ");
}

export function gateInPatch(files: readonly { patch?: string }[], gate: string): boolean {
  return files.some((file) => file.patch?.includes(gate));
}

/** The branch an experiment's change is built on. */
export function experimentBranch(flag: string): string {
  return `kismet/exp-${flag}`;
}

/**
 * The brief a coding agent builds from. Kismet's own agent starts on the default branch and reports
 * the branch it pushed. With `checkout`, an outside agent (Cursor, Claude Code) starts on the
 * experiment branch Kismet already created, and its own tooling pushes the change.
 */
export function experimentTask(
  experiment: TaskExperiment,
  signal: TaskSignal | undefined,
  external: boolean,
  checkout = false,
): string {
  const evidence = signal?.evidence.slice(0, 5).map((item) => `- ${item.title}`) ?? [];
  const branch = experimentBranch(experiment.flag);
  return [
    checkout ? "Build this A/B experiment in this repository." : "Build this A/B experiment in the repository at /workspace/repo.",
    `PROBLEM: ${signal?.title ?? ""} — ${signal?.problem ?? ""}`,
    evidence.length ? `EVIDENCE:\n${evidence.join("\n")}` : "",
    `EXPERIMENT: ${experiment.title}\nHYPOTHESIS: ${experiment.hypothesis}\nPAGE: ${experiment.page}`,
    `CONTROL: ${experiment.control}\nTREATMENT: ${experiment.treatment}`,
    `METRIC: ${experiment.metric}\nGUARDRAIL: ${experiment.guardrail}`,
    `RULES: ${codeRules(experiment.flag, external)}`,
    checkout
      ? `You are on branch ${branch}, which Kismet created for this experiment. Stay on it and change only what this experiment needs.`
      : `Work on branch ${branch} from the default branch; change only what this experiment needs.`,
    "Control must render exactly what it renders today.",
    `Add data-track="${experiment.flag}" to the new element.`,
    checkout
      ? "Run the project's checks if they finish in a few minutes."
      : "Run the project's checks if they finish in a few minutes. Commit and push the change.",
    checkout
      ? "Do not open a pull request and do not merge anything. Kismet checks the change and opens the pull request."
      : `End your final response with exactly: BRANCH: ${branch}`,
  ].filter(Boolean).join("\n\n");
}

export function pullBody(experiment: TaskExperiment, signal: TaskSignal | undefined, summary: string): string {
  const evidence = signal?.evidence ?? [];
  const synthetic = evidence.filter((item) => item.synthetic).length;
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
    ...evidence.slice(0, 8).map((item) => `- ${item.synthetic ? "_(synthetic)_ " : ""}[${item.source}] ${item.title}`),
    "",
    `The change is dark until Kismet starts the experiment (flag \`${experiment.flag}\`, 50/50 split).`,
    "Approve it from Kismet's Experiments page, or merge this PR — merging is the approval.",
    "",
    "_Opened by Kismet._",
  ].filter((line) => line !== "").join("\n");
}

export function fixPullBody(experiment: TaskExperiment, signal: TaskSignal | undefined, agentReport: string): string {
  return [
    `## ${experiment.title}`,
    "",
    "### Complaints",
    ...(signal?.evidence.slice(0, 8).map((item) => `- [${item.source ?? "unknown"}] “${item.title}”`) ?? ["- No complaint text available."]),
    "",
    "### What was broken",
    experiment.hypothesis || experiment.control,
    "",
    "### Fix",
    experiment.treatment,
    "",
    "### Tests run",
    agentReport.trim() || "See the commits and pull request checks for the coding agent's verification.",
    "",
    "After merge, Kismet watches for new complaints for 14 days.",
    "",
    "_Opened by Kismet._",
  ].join("\n");
}
