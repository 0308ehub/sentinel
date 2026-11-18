/** Who writes the code for an experiment. "kismet" is Kismet's own coding agent; the others run on the account's own tools. */
export const BUILDERS = ["kismet", "cursor", "claude-code"] as const;
export type Builder = (typeof BUILDERS)[number];
export type OutsideBuilder = Exclude<Builder, "kismet">;

export const BUILDER_NAME: Record<Builder, string> = {
  kismet: "Kismet's coding agent",
  cursor: "Cursor",
  "claude-code": "Claude Code",
};

export function parseBuilder(value: unknown): Builder {
  return BUILDERS.find((builder) => builder === value) ?? "kismet";
}

export function isOutsideBuilder(value: unknown): value is OutsideBuilder {
  return value === "cursor" || value === "claude-code";
}

export type BuildProgress = { state: "running" } | { state: "finished" } | { state: "failed"; reason: string };

const failed = (reason: string): BuildProgress => ({ state: "failed", reason });

/** Reads a Cursor cloud agent run. A status Kismet does not know counts as still running. */
export function cursorProgress(status: string | undefined): BuildProgress {
  if (status === "FINISHED") return { state: "finished" };
  if (status === "ERROR") return failed("the Cursor agent ended with an error");
  if (status === "CANCELLED") return failed("the Cursor agent was cancelled");
  if (status === "EXPIRED") return failed("the Cursor agent expired before it finished");
  return { state: "running" };
}

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

/** GitHub lists a dispatched run a few seconds late. After this long with no run, the build has failed. */
export const WORKFLOW_START_GRACE_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;

/** The newest run that belongs to this build: runs from before the build started are an earlier attempt. */
export function pickWorkflowRun(runs: readonly WorkflowRun[], startedAt: string | null): WorkflowRun | null {
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  const mine = runs.filter((run) => {
    const created = Date.parse(run.createdAt);
    return !Number.isFinite(started) || !Number.isFinite(created) || created >= started - CLOCK_SKEW_MS;
  });
  mine.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return mine[0] ?? null;
}

/** Reads the GitHub Actions run that Claude Code works in. */
export function workflowProgress(run: WorkflowRun | null, startedAt: string | null, now: number): BuildProgress {
  if (!run) {
    const started = startedAt ? Date.parse(startedAt) : Number.NaN;
    if (Number.isFinite(started) && now - started > WORKFLOW_START_GRACE_MS) {
      return failed("the GitHub Actions run never started");
    }
    return { state: "running" };
  }
  if (run.status !== "completed") return { state: "running" };
  if (run.conclusion === "success") return { state: "finished" };
  if (run.conclusion === "cancelled") return failed("the Claude Code run was cancelled on GitHub");
  if (run.conclusion === "timed_out") return failed("the Claude Code run timed out on GitHub");
  return failed("the Claude Code run failed on GitHub Actions");
}

/** A Cursor build is stored as "agent/run"; both halves are needed to read or cancel it. */
export function cursorRef(agentId: string, runId: string): string {
  return `${agentId}/${runId}`;
}

export function parseCursorRef(ref: string): { agentId: string; runId: string } | null {
  const [agentId, runId, extra] = ref.split("/");
  if (!agentId || !runId || extra !== undefined) return null;
  return { agentId, runId };
}

export const CLAUDE_WORKFLOW_FILE = "kismet-build.yml";
export const CLAUDE_WORKFLOW_PATH = `.github/workflows/${CLAUDE_WORKFLOW_FILE}`;

/**
 * The workflow an account adds to its repository so Kismet can start Claude Code there.
 * Kismet starts it on the experiment branch; Claude Code edits files and the last step pushes them.
 */
export const CLAUDE_WORKFLOW_YAML = [
  "# Kismet starts this workflow to have Claude Code write the change for one experiment.",
  "# Needs the repository secret ANTHROPIC_API_KEY (Settings → Secrets and variables → Actions).",
  "name: Kismet build",
  'run-name: "Kismet: ${{ inputs.title }}"',
  "",
  "on:",
  "  workflow_dispatch:",
  "    inputs:",
  "      title:",
  "        description: Experiment title",
  "        required: true",
  "        type: string",
  "      task:",
  "        description: What Claude Code should build",
  "        required: true",
  "        type: string",
  "",
  "permissions:",
  "  contents: write",
  "",
  "jobs:",
  "  build:",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 30",
  "    steps:",
  "      - uses: actions/checkout@v6",
  "      - uses: anthropics/claude-code-action@v1",
  "        with:",
  "          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}",
  "          github_token: ${{ github.token }}",
  "          prompt: ${{ inputs.task }}",
  "      - name: Push the change",
  "        env:",
  "          TITLE: ${{ inputs.title }}",
  "        run: |",
  '          git config user.name "github-actions[bot]"',
  '          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
  "          git add -A",
  '          git diff --cached --quiet || git commit -m "$TITLE"',
  '          if [ "$(git rev-list --count "${GITHUB_SHA}..HEAD")" = "0" ]; then',
  '            echo "::error::Claude Code wrote no change."',
  "            exit 1",
  "          fi",
  '          git push origin "HEAD:${GITHUB_REF_NAME}"',
  "",
].join("\n");
