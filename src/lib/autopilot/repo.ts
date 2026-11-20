import "server-only";

import { db } from "@/lib/autopilot/db";
import { siteAutopilotUser, tryAutopilotUser } from "@/lib/autopilot/scope";
import { currentAccountId } from "@/lib/connections/current";
import { repoOwner } from "@/lib/connections/ownership";
import { repoName } from "@/lib/github/client";

/** The GitHub repository Autopilot ships to when an account has not chosen one. */
export function defaultAutopilotRepo(): string {
  return process.env.AUTOPILOT_REPO?.trim() || "0308ehub/sentinel";
}

export const NO_REPO_MESSAGE = "Choose the repository Kismet ships to in Settings → Connectors → GitHub.";

export function repoOwnedElsewhereMessage(repo: string): string {
  return `Another Kismet account ships to ${repo}. Choose a different repository in Settings → Connectors → GitHub.`;
}

export function repoTakenMessage(repo: string): string {
  return `Another Kismet account already ships to ${repo}. Until shared team workspaces arrive, one account per repository.`;
}

async function selectedRepo(userId: string): Promise<string | null> {
  const sql = await db();
  const rows = await sql<{ repo: string }[]>`select repo from kismet.autopilot_repo where user_id = ${userId} limit 1`;
  const explicit = rows[0]?.repo?.trim() ?? "";
  if (repoName(explicit)) return explicit;
  return userId === await siteAutopilotUser() ? defaultAutopilotRepo() : null;
}

/**
 * The repository chosen by the account whose loop is running, or the signed-in account.
 * Only the deployment owner falls back to the default; other accounts ship nowhere until they choose.
 */
export async function chosenAutopilotRepo(): Promise<string | null> {
  const userId = tryAutopilotUser() ?? (await currentAccountId());
  if (!userId) return null;
  const repo = await selectedRepo(userId);
  if (!repo) return null;
  const owner = await repoOwner(repo);
  return !owner || owner === userId ? repo : null;
}

/** Why the current account cannot use its selected repository, if ownership is the blocker. */
export async function chosenAutopilotRepoReason(): Promise<string | null> {
  const userId = tryAutopilotUser() ?? (await currentAccountId());
  if (!userId) return null;
  const repo = await selectedRepo(userId);
  if (!repo) return null;
  const owner = await repoOwner(repo);
  return owner && owner !== userId ? repoOwnedElsewhereMessage(repo) : null;
}

/** Like chosenAutopilotRepo, but for steps that cannot continue without a repository. */
export async function autopilotRepo(): Promise<string> {
  const repo = await chosenAutopilotRepo();
  if (!repo) throw new Error(NO_REPO_MESSAGE);
  return repo;
}

export async function setAutopilotRepo(userId: string, repo: string): Promise<void> {
  if (!repoName(repo)) throw new Error("Choose a repository like owner/name.");
  const owner = await repoOwner(repo);
  if (owner && owner !== userId) throw new Error(repoTakenMessage(repo.trim()));
  const sql = await db();
  await sql`
    insert into kismet.autopilot_repo (user_id, repo)
    values (${userId}, ${repo.trim()})
    on conflict (user_id) do update set repo = excluded.repo, updated_at = now()
  `;
}

/** Dry run: Autopilot writes the change but never pushes, merges or closes anything on GitHub. */
export function autopilotDryRun(): boolean {
  return process.env.AUTOPILOT_DRY_RUN?.trim() === "1";
}
