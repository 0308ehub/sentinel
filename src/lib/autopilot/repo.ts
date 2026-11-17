import "server-only";

import { db } from "@/lib/autopilot/db";
import { siteAutopilotUser, tryAutopilotUser } from "@/lib/autopilot/scope";
import { currentUserId } from "@/lib/connections/current";
import { repoName } from "@/lib/github/client";

/** The GitHub repository Autopilot ships to when an account has not chosen one. */
export function defaultAutopilotRepo(): string {
  return process.env.AUTOPILOT_REPO?.trim() || "0308ehub/sentinel";
}

export const NO_REPO_MESSAGE = "Choose the repository Autopilot ships to in Settings → Connectors → GitHub.";

/**
 * The repository chosen by the account whose loop is running, or the signed-in account.
 * Only the deployment owner falls back to the default; other accounts ship nowhere until they choose.
 */
export async function chosenAutopilotRepo(): Promise<string | null> {
  const userId = tryAutopilotUser() ?? (await currentUserId());
  if (!userId) return null;
  const sql = await db();
  const rows = await sql<{ repo: string }[]>`select repo from kismet.autopilot_repo where user_id = ${userId} limit 1`;
  const repo = rows[0]?.repo?.trim() ?? "";
  if (repoName(repo)) return repo;
  return userId === siteAutopilotUser() ? defaultAutopilotRepo() : null;
}

/** Like chosenAutopilotRepo, but for steps that cannot continue without a repository. */
export async function autopilotRepo(): Promise<string> {
  const repo = await chosenAutopilotRepo();
  if (!repo) throw new Error(NO_REPO_MESSAGE);
  return repo;
}

export async function setAutopilotRepo(userId: string, repo: string): Promise<void> {
  if (!repoName(repo)) throw new Error("Choose a repository like owner/name.");
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
