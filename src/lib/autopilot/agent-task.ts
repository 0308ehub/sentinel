import type { MetricSpec } from "./assign.ts";
import { SERVER_SDK_FILE, SERVER_SDK_SOURCE, SERVER_SDK_TYPES, SERVER_SDK_TYPES_FILE } from "../sdk/kismet-server.ts";

interface TaskExperiment {
  flag: string;
  title: string;
  hypothesis: string;
  page: string;
  control: string;
  treatment: string;
  metric: string;
  guardrail: string;
  kind?: "experiment" | "test" | "change" | "fix";
  mode?: "deterministic" | "stochastic";
  metricSpec?: MetricSpec | null;
  adjustments?: string | null;
}

function personNotes(adjustments: string | null | undefined): string {
  return adjustments?.trim() ? `NOTES FROM THE PERSON (follow these)\n${adjustments.trim()}` : "";
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
    personNotes(experiment.adjustments),
    "Reproduce or locate the bug by reading the code and cite the relevant path:line in your final response. Make the smallest correct fix of the root cause.",
    "Add or update a test when the repository has tests nearby. Run the project's relevant checks. Never add a feature flag, variant, experiment gate, or A/B test.",
    "Work quickly. Read only the files you need. Check your work with the fastest relevant checks (type-check and lint the files you changed, run the tests that cover them). Do not run a full production build, do not reinstall dependencies unless a check fails because they are missing, and do not explore unrelated parts of the repo.",
    "Before changing anything, run `git fetch origin` and start from the latest remote default branch, never a stale local copy.",
    `Work on branch ${branch} from the default branch. Never touch unrelated code. Commit and push the change, but do not open or merge a pull request.`,
    "If you cannot find a real bug supported by the complaints, say so plainly and do not push a branch.",
    "If the request does not actually need a code change (for example it asks you not to change anything, or nothing in the code is wrong), do not push a branch. End your final response with exactly: NO CHANGE NEEDED: <one sentence why>",
    "Never push a branch whose only change is a data-kismet-fix or data-track attribute.",
    `If you pushed the fix, end your final response with exactly: BRANCH: ${branch}`,
  ].filter(Boolean).join("\n\n");
}

/** A quick fix ships to everyone. The changed element is marked so the draft can be checked. */
export function fixRules(flag: string): string {
  return [
    "Apply this change directly. Do not add a feature flag, useVariant, window.kismet, or a control and treatment split.",
    "Everyone who loads the page should see the new version, including during server rendering.",
    "The change must appear only where the request says, never on other pages.",
    "Use only components and imports that already exist in the file or in the files shown. Match the existing style.",
    `Add data-kismet-fix="${flag}" on the element you changed.`,
    "Do not invent data, results, or claims.",
  ].join(" ");
}

export function fixMark(flag: string): string {
  return `data-kismet-fix="${flag}"`;
}

export function changeTitle(experiment: { kind?: string; title: string }): string {
  const label = experiment.kind === "fix" ? "Quick fix" : "Experiment";
  return `${label}: ${experiment.title}`.slice(0, 120);
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

/** How the experiment is measured when the metric is an event the site reports itself. */
export function trackRules(spec: MetricSpec | null | undefined, external: boolean): string {
  if (spec?.kind !== "event") return "";
  const call = external
    ? `window.kismet?.track("${spec.name}") in browser code, or await kismet.track("${spec.name}", visitor.id) with the server SDK in server code`
    : `const track = useTrack() from "@/lib/autopilot/variant" and track("${spec.name}") in a client component`;
  return [
    `MEASUREMENT: this experiment is measured by the event "${spec.name}".`,
    `Find the code where that outcome actually happens (the success path, after it is confirmed). If it does not already report "${spec.name}", add ${call}.`,
    "The call must run in BOTH control and treatment, exactly once per outcome, so the versions are compared fairly. Never put it inside the new element only.",
  ].join(" ");
}

/** For a change that runs on the server, where window.kismet does not exist. */
export function serverRules(flag: string): string {
  return [
    "SERVER CODE: if this change runs on the server (a route handler, server action, server component, API, or a prompt or model call), do not use window.kismet there.",
    `Instead add the Kismet server SDK: create ${SERVER_SDK_FILE} and ${SERVER_SDK_TYPES_FILE} in the project's lib or utils folder with exactly the contents under SERVER SDK below, unchanged.`,
    `Then: import { kismet } from "<relative path>/kismet-server.mjs"; const visitor = kismet.visitorFrom(<the request's Cookie header>); const variant = await kismet.variant("${flag}", visitor.id);`,
    'Use the new version only when variant === "treatment". When visitor.setCookie is not null, add it to the response as a Set-Cookie header.',
    "In a serverless function, await kismet.flush() before the response is returned.",
    "The SDK reads the site key from the KISMET_SITE_KEY environment variable. Do not hardcode it. Say in your final response that KISMET_SITE_KEY must be set.",
  ].join(" ");
}

function serverSdkFiles(): string {
  return `SERVER SDK\n--- ${SERVER_SDK_FILE} ---\n${SERVER_SDK_SOURCE}\n--- ${SERVER_SDK_TYPES_FILE} ---\n${SERVER_SDK_TYPES}`;
}

/** The text the experiment gate starts with. The server form adds the visitor after the flag. */
export function experimentGate(flag: string, external: boolean): string {
  return external ? `kismet.variant("${flag}"` : `useVariant("${flag}")`;
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
  const fix = experiment.kind === "fix";
  return [
    checkout
      ? `Build this ${fix ? "quick fix" : "A/B experiment"} in this repository.`
      : `Build this ${fix ? "quick fix" : "A/B experiment"} in the repository at /workspace/repo.`,
    `PROBLEM: ${signal?.title ?? ""} — ${signal?.problem ?? ""}`,
    evidence.length ? `EVIDENCE:\n${evidence.join("\n")}` : "",
    `EXPERIMENT: ${experiment.title}\nHYPOTHESIS: ${experiment.hypothesis}\nPAGE: ${experiment.page}`,
    `CONTROL: ${experiment.control}\nTREATMENT: ${experiment.treatment}`,
    personNotes(experiment.adjustments),
    `METRIC: ${experiment.metric}\nGUARDRAIL: ${experiment.guardrail}`,
    `RULES: ${fix ? fixRules(experiment.flag) : codeRules(experiment.flag, external)}`,
    checkout
      ? `You are on branch ${branch}, which Kismet created for this change. Stay on it and change only what this ${fix ? "fix" : "experiment"} needs.`
      : `Run \`git fetch origin\` first, then work on branch ${branch} from the latest remote default branch; change only what this ${fix ? "fix" : "experiment"} needs.`,
    fix
      ? "Ship the new version to everyone. Do not leave the old version behind a flag."
      : "Control must render exactly what it renders today.",
    !fix && experiment.mode === "stochastic"
      ? "This change can come out differently on each request. Do not cache one sample of the text. Keep the same inputs and let it run again for each visitor. The flag splits visitors, not one response."
      : "",
    fix ? "" : trackRules(experiment.metricSpec, external),
    !fix && external ? serverRules(experiment.flag) : "",
    fix ? `Add data-kismet-fix="${experiment.flag}" on the changed element.` : `If the change adds a visible element, add data-track="${experiment.flag}" to it.`,
    "Work quickly. Read only the files you need. Check your work with the fastest relevant checks (type-check and lint the files you changed, run the tests that cover them). Do not run a full production build, do not reinstall dependencies unless a check fails because they are missing, and do not explore unrelated parts of the repo.",
    "If the request does not actually need a code change (for example it asks you not to change anything, or nothing in the code is wrong), do not push a branch. End your final response with exactly: NO CHANGE NEEDED: <one sentence why>",
    "Never push a branch whose only change is a data-kismet-fix or data-track attribute.",
    checkout
      ? "Run the project's checks if they finish in a few minutes."
      : "Run the project's checks if they finish in a few minutes. Commit and push the change.",
    checkout
      ? "Do not open a pull request and do not merge anything. Kismet checks the change and opens the pull request."
      : `End your final response with exactly: BRANCH: ${branch}`,
    !fix && external ? serverSdkFiles() : "",
  ].filter(Boolean).join("\n\n");
}

export function pullBody(experiment: TaskExperiment, signal: TaskSignal | undefined, summary: string, serverSdk = false): string {
  const evidence = signal?.evidence ?? [];
  const synthetic = evidence.filter((item) => item.synthetic).length;
  const fix = experiment.kind === "fix";
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
    fix
      ? "This is a quick fix. Approving it ships the change to everyone. There is no A/B split."
      : `The change is dark until Kismet starts the experiment (flag \`${experiment.flag}\`, 50/50 split).`,
    serverSdk
      ? `This change adds the Kismet server SDK (\`${SERVER_SDK_FILE}\`). Set \`KISMET_SITE_KEY\` in the server environment to the \`data-site\` value of your Kismet script tag before merging, or every visitor gets the current version.`
      : "",
    "Approve it from the Dashboard, or merge this PR — merging is the approval.",
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
