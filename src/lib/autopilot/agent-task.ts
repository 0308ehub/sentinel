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

export function experimentTask(experiment: TaskExperiment, signal: TaskSignal | undefined, external: boolean): string {
  const evidence = signal?.evidence.slice(0, 5).map((item) => `- ${item.title}`) ?? [];
  return [
    "Build this A/B experiment in the repository at /workspace/repo.",
    `PROBLEM: ${signal?.title ?? ""} — ${signal?.problem ?? ""}`,
    evidence.length ? `EVIDENCE:\n${evidence.join("\n")}` : "",
    `EXPERIMENT: ${experiment.title}\nHYPOTHESIS: ${experiment.hypothesis}\nPAGE: ${experiment.page}`,
    `CONTROL: ${experiment.control}\nTREATMENT: ${experiment.treatment}`,
    `METRIC: ${experiment.metric}\nGUARDRAIL: ${experiment.guardrail}`,
    `RULES: ${codeRules(experiment.flag, external)}`,
    `Work on branch kismet/exp-${experiment.flag} from the default branch; change only what this experiment needs.`,
    "Control must render exactly what it renders today.",
    `Add data-track="${experiment.flag}" to the new element.`,
    "Run the project's checks if they finish in a few minutes. Commit and push the change.",
    `End your final response with exactly: BRANCH: kismet/exp-${experiment.flag}`,
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
