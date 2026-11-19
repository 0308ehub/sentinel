import "server-only";

import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import { db, newId } from "@/lib/autopilot/db";
import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { sanitizeSnapshotHtml } from "@/lib/autopilot/snapshot-html";
import { autopilotUser } from "@/lib/autopilot/scope";
import { agentBudgetLeft, recordAgentSession } from "@/lib/autopilot/spend";
import type { Experiment } from "@/lib/autopilot/types";
import { client, managedSessionView } from "@/lib/coder/sessions";
import { githubTokenFor } from "@/lib/github/app";
import { branchHeadSha, pullChanges } from "@/lib/github/client";

const SNAPSHOT_BUDGET_CENTS = "150";
const MAX_RENDER_SCRIPT_BYTES = 40 * 1024;
const DAILY_LIMIT = 10;
const MAX_AGE_MINUTES = 20;
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01" as const;

export type SnapshotStatus = "rendering" | "ready" | "failed";

export interface SnapshotRow {
  id: string;
  experimentId: string;
  sha: string;
  status: SnapshotStatus;
  sessionId: string | null;
  scenario: string | null;
  controlHtml: string | null;
  treatmentHtml: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  usedRecipe: boolean;
}

type SnapshotDbRow = {
  id: string;
  experiment_id: string;
  sha: string;
  status: SnapshotStatus;
  session_id: string | null;
  scenario: string | null;
  control_html: string | null;
  treatment_html: string | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  used_recipe: boolean;
};

type RenderRecipeRow = { recipe: string; script: string | null };
type RecipeAttemptRow = { status: SnapshotStatus; used_recipe: boolean };

export class SnapshotError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

function toSnapshot(row: SnapshotDbRow): SnapshotRow {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    sha: row.sha,
    status: row.status,
    sessionId: row.session_id,
    scenario: row.scenario,
    controlHtml: row.control_html,
    treatmentHtml: row.treatment_html,
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    usedRecipe: row.used_recipe,
  };
}

async function repoAndToken(): Promise<{ repo: string; token: string }> {
  const userId = autopilotUser();
  const repo = await chosenAutopilotRepo();
  if (!repo) throw new SnapshotError("Connect GitHub and choose a repository first.");
  const token = await githubTokenFor(userId, repo);
  if (!token) throw new SnapshotError("Connect GitHub and choose a repository first.");
  return { repo, token };
}

export async function snapshotSource(experiment: Experiment): Promise<{ sha: string } | null> {
  if (!experiment.prNumber && !experiment.branch) return null;
  const { repo, token } = await repoAndToken();
  if (experiment.prNumber) {
    const pull = await pullChanges(repo, experiment.prNumber, token);
    return pull.headSha ? { sha: pull.headSha } : null;
  }
  return { sha: await branchHeadSha(repo, experiment.branch!, token) };
}

export async function snapshotFor(experimentId: string, sha: string): Promise<SnapshotRow | null> {
  const sql = await db();
  const rows = await sql<SnapshotDbRow[]>`
    select * from kismet.experiment_snapshots
    where user_id = ${autopilotUser()} and experiment_id = ${experimentId} and sha = ${sha}
    limit 1
  `;
  return rows[0] ? toSnapshot(rows[0]) : null;
}

function renderMessage(experiment: Experiment, summary: ChangeSummary, recipe: RenderRecipeRow | null): string {
  const previous = recipe ? `
WHAT WORKED LAST TIME IN THIS REPO
${recipe.recipe}
${recipe.script ? `\nReusable script:\n\`\`\`js\n${recipe.script}\n\`\`\`` : ""}
Start from this. Adapt only what this change needs (sample data, the component, the flag). Update recipe.md/render.mjs if you change the approach.
` : "";
  return `Render two static snapshots of a page from this repository so a product person can see what an A/B experiment changes. Do not commit, push, open pull requests, or change anything outside this sandbox. No secrets.
Page: ${experiment.page}. Experiment flag: "${experiment.flag}". The change: ${experiment.treatment}. Before: ${summary.before}. After: ${summary.after}.
Situation to show: ${summary.when || "the page's normal state"}. Use realistic sample data that puts the page in exactly that situation (for example, an account with no experiments if the change only appears when the list is empty).
Produce the page twice: once as the current version (flag "control") and once as the new version (flag "treatment"). In this codebase the flag is read with useVariant("${experiment.flag}") from src/lib/autopilot/variant.ts, whose value comes from ExperimentContext (arms: { "${experiment.flag}": "control" | "treatment" }); other sites read window.kismet.variant("${experiment.flag}"). Force the arm that way.
Do not install or use browsers, puppeteer, playwright, or chromium, and do not produce images. Produce only the five output files. Render with react-dom/server (renderToStaticMarkup) and compile CSS with the project's own Tailwind/PostCSS setup. Prefer npm ci --ignore-scripts (or the repo's lockfile tool) once; don't run the dev server or a production build. Keep app chrome (sidebars, nav) out unless the change is in it. No network except package registries; no database, auth, or API keys.
Write /mnt/session/outputs/control.html and /mnt/session/outputs/treatment.html — complete, self-contained HTML documents (all CSS inlined in a <style>, no <script>, no external URLs, desktop width 1280px, white background), and /mnt/session/outputs/scenario.json as {"scenario": "<one short sentence naming the situation shown, e.g. An account with no experiments yet>"}.
Also write /mnt/session/outputs/recipe.md with short, exact steps that worked in this repo (install commands, how CSS was compiled, and how providers/sample data were set up), and /mnt/session/outputs/render.mjs with the reusable script you ran, parameterized by arm and sample data where practical and under 40 KB.
Check that treatment.html visibly contains the change and control.html does not. If you cannot render the page faithfully, write scenario.json with {"error": "<why>"} and stop.
${previous}`;
}

export async function startSnapshot(experiment: Experiment, summary: ChangeSummary): Promise<SnapshotRow | null> {
  const agentId = process.env.KISMET_RENDER_AGENT_ID?.trim() || process.env.KISMET_CODER_AGENT_ID?.trim();
  if (!process.env.ANTHROPIC_API_KEY?.trim() || !agentId || !process.env.KISMET_CODER_ENVIRONMENT_ID?.trim()) {
    throw new SnapshotError("Kismet's rendering agent is not configured.");
  }
  if (summary.kind !== "ui") throw new SnapshotError("Only visual changes can be rendered.");
  if (await agentBudgetLeft() <= 0) {
    console.info("[autopilot] skipped sample preview: account daily spending limit reached");
    return null;
  }
  const source = await snapshotSource(experiment);
  if (!source) throw new SnapshotError("This change does not have code to render yet.");
  const existing = await snapshotFor(experiment.id, source.sha);
  if (existing && !(existing.status === "failed" && Date.now() - Date.parse(existing.updatedAt) > 60 * 60 * 1000)) {
    return existing;
  }

  const sql = await db();
  const userId = autopilotUser();
  const [counts] = await sql<{ rendering: number; starts: number }[]>`
    select
      count(*) filter (where status = 'rendering')::int as rendering,
      count(*) filter (where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')::int as starts
    from kismet.experiment_snapshots where user_id = ${userId}
  `;
  if ((counts?.rendering ?? 0) >= 1) throw new SnapshotError("Another sample preview is already rendering.");
  if ((counts?.starts ?? 0) >= DAILY_LIMIT) throw new SnapshotError("Daily sample preview limit reached. Try again tomorrow.");
  const { repo, token } = await repoAndToken();
  const attempts = await sql<RecipeAttemptRow[]>`
    select status, used_recipe from kismet.experiment_snapshots
    where user_id = ${userId} and experiment_id = ${experiment.id}
    order by updated_at desc limit 1
  `;
  const skipRecipe = attempts[0]?.status === "failed" && attempts[0].used_recipe;
  const recipeRows = skipRecipe ? [] : await sql<RenderRecipeRow[]>`
    select recipe, script from kismet.render_recipes where user_id = ${userId} and repo = ${repo} limit 1
  `;
  const recipe = recipeRows[0] ?? null;
  const title = `Render: ${experiment.title}`.slice(0, 80);
  const session = await client().beta.sessions.create({
    agent: agentId,
    environment_id: process.env.KISMET_CODER_ENVIRONMENT_ID!,
    title,
    budget: { type: "limit", max_list_cost: { amount: SNAPSHOT_BUDGET_CENTS, currency: "USD" } },
    metadata: { kismet_user: userId, kismet_experiment: experiment.id, kismet_task: "snapshot" },
    resources: [{
      type: "github_repository",
      url: `https://github.com/${repo}`,
      authorization_token: token,
      mount_path: "/workspace/repo",
      checkout: { type: "commit", sha: source.sha },
    }],
    initial_events: [{ type: "user.message", content: [{ type: "text", text: renderMessage(experiment, summary, recipe) }] }],
  });
  await recordAgentSession({ sessionId: session.id, userId, kind: "render", experimentId: experiment.id, title }).catch(() => {});
  const id = existing?.id ?? newId("snapshot");
  const rows = await sql<SnapshotDbRow[]>`
    insert into kismet.experiment_snapshots
      (id, user_id, experiment_id, sha, status, session_id, scenario, control_html, treatment_html, error, used_recipe, updated_at)
    values (${id}, ${userId}, ${experiment.id}, ${source.sha}, 'rendering', ${session.id}, null, null, null, null, ${Boolean(recipe)}, now())
    on conflict (user_id, experiment_id, sha) do update set
      status = 'rendering', session_id = excluded.session_id, scenario = null,
      control_html = null, treatment_html = null, error = null, used_recipe = excluded.used_recipe, updated_at = now()
    returning *
  `;
  return toSnapshot(rows[0]);
}

async function outputFiles(sessionId: string): Promise<Map<string, string>> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const files = [];
    for await (const file of client().beta.files.list({ scope_id: sessionId, betas: [MANAGED_AGENTS_BETA] })) files.push(file);
    const wanted = files.filter((file) => ["control.html", "treatment.html", "scenario.json", "recipe.md", "render.mjs"]
      .some((name) => file.filename.endsWith(name)));
    if (wanted.length >= 3 || attempt === 2) {
      const results = new Map<string, string>();
      await Promise.all(wanted.map(async (file) => {
        const response = await client().beta.files.download(file.id);
        results.set(file.filename.split("/").pop()!, await response.text());
      }));
      return results;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  return new Map();
}

async function failSnapshot(id: string, error: string): Promise<void> {
  const sql = await db();
  await sql`
    update kismet.experiment_snapshots set status = 'failed', error = ${error.slice(0, 1000)}, updated_at = now()
    where id = ${id} and user_id = ${autopilotUser()}
  `;
}

async function finishSnapshot(row: SnapshotRow): Promise<void> {
  const files = await outputFiles(row.sessionId!);
  const scenarioText = files.get("scenario.json");
  if (!scenarioText) return failSnapshot(row.id, "The coding agent did not produce scenario.json.");
  let scenario: { scenario?: unknown; error?: unknown };
  try {
    scenario = JSON.parse(scenarioText) as { scenario?: unknown; error?: unknown };
  } catch {
    return failSnapshot(row.id, "The coding agent produced invalid scenario data.");
  }
  if (typeof scenario.error === "string" && scenario.error.trim()) return failSnapshot(row.id, scenario.error.trim());
  const control = files.get("control.html");
  const treatment = files.get("treatment.html");
  if (!control || !treatment) return failSnapshot(row.id, "The coding agent did not produce both versions.");
  try {
    const sql = await db();
    await sql`
      update kismet.experiment_snapshots set status = 'ready', scenario = ${String(scenario.scenario ?? "Sample data").slice(0, 240)},
        control_html = ${sanitizeSnapshotHtml(control)}, treatment_html = ${sanitizeSnapshotHtml(treatment)}, error = null, updated_at = now()
      where id = ${row.id} and user_id = ${autopilotUser()}
    `;
    const recipe = files.get("recipe.md")?.trim();
    if (recipe) {
      const { repo } = await repoAndToken();
      const script = files.get("render.mjs");
      const savedScript = script && Buffer.byteLength(script, "utf8") <= MAX_RENDER_SCRIPT_BYTES ? script : null;
      await sql`
        insert into kismet.render_recipes (user_id, repo, recipe, script, updated_at)
        values (${autopilotUser()}, ${repo}, ${recipe}, ${savedScript}, now())
        on conflict (user_id, repo) do update set
          recipe = excluded.recipe, script = excluded.script, updated_at = now()
      `;
    }
  } catch (error) {
    await failSnapshot(row.id, error instanceof Error ? error.message : "The rendered files could not be saved.");
  }
}

export async function followSnapshots(): Promise<string | null> {
  const sql = await db();
  const rows = await sql<SnapshotDbRow[]>`
    select * from kismet.experiment_snapshots where user_id = ${autopilotUser()} and status = 'rendering'
    order by created_at asc
  `;
  let completed = 0;
  for (const dbRow of rows) {
    const row = toSnapshot(dbRow);
    if (!row.sessionId) {
      await failSnapshot(row.id, "The rendering session is missing.");
      continue;
    }
    const view = await managedSessionView(row.sessionId);
    if ((view.status === "running" || view.status === "rescheduling")
      && Date.now() - Date.parse(row.createdAt) > MAX_AGE_MINUTES * 60 * 1000) {
      await client().beta.sessions.events.send(row.sessionId, { events: [{ type: "user.interrupt" }] }).catch(() => {});
      await failSnapshot(row.id, "Rendering took too long");
      continue;
    }
    if (view.stopReason === "requires_action" && view.pendingApproval) {
      await client().beta.sessions.events.send(row.sessionId, { events: [{
        type: "user.tool_confirmation",
        tool_use_id: view.pendingApproval.toolUseId,
        result: "deny",
        deny_message: "Nobody is watching this render; skip steps that need approval and finish without them.",
      }] });
      continue;
    }
    if ((view.status === "idle" && view.stopReason === "end_turn") || view.status === "terminated") {
      await finishSnapshot(row);
      completed += 1;
    }
  }
  return completed ? `Finished ${completed} sample preview${completed === 1 ? "" : "s"}.` : null;
}

export async function snapshotOwnerBySession(sessionId: string): Promise<string | null> {
  const sql = await db();
  const rows = await sql<{ user_id: string }[]>`
    select user_id from kismet.experiment_snapshots where session_id = ${sessionId} limit 1
  `;
  return rows[0]?.user_id ?? null;
}
