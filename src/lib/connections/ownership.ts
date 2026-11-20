import "server-only";

import { db } from "@/lib/autopilot/db";
import { siteAutopilotUser } from "@/lib/autopilot/scope";
import { actingUserId } from "@/lib/connections/current";
import { getConnection } from "@/lib/connections/store";
import { repositoryOwner, slackOwner } from "@/lib/connections/ownership-core";

export const SLACK_TEAM_TAKEN_MESSAGE = "This Slack workspace is already connected to another Kismet account. Until shared team workspaces arrive, one account per Slack workspace.";

export async function slackTeamOwner(teamId: string): Promise<string | null> {
  const sql = await db();
  const rows = await sql<{ user_id: string; created_at: Date | null }[]>`
    select user_id, created_at from kismet.connections
    where provider = 'slack' and meta ->> 'teamId' = ${teamId}
  `;
  return slackOwner(rows.map((row) => ({ userId: row.user_id, createdAt: row.created_at })), siteAutopilotUser());
}

/** The one account allowed to consume events and interactions for a Slack workspace. */
/** Whether this account may connect the Slack workspace: it is free, already theirs, or they own the deployment. */
export async function canConnectSlackTeam(userId: string, teamId: string): Promise<boolean> {
  if (userId === siteAutopilotUser()) return true;
  const owner = await slackTeamOwner(teamId);
  return !owner || owner === userId;
}

export async function slackTeamAccount(teamId: string): Promise<string | null> {
  return slackTeamOwner(teamId);
}

export async function slackActiveForAccount(userId?: string): Promise<boolean> {
  const accountId = userId ?? await actingUserId();
  if (!accountId) return false;
  const connection = await getConnection(accountId, "slack");
  const teamId = connection?.meta.teamId;
  if (typeof teamId !== "string" || !teamId) return false;
  return (await slackTeamOwner(teamId)) === accountId;
}

function defaultRepo(): string {
  return process.env.AUTOPILOT_REPO?.trim() || "0308ehub/sentinel";
}

export async function repoOwner(repo: string): Promise<string | null> {
  const sql = await db();
  const deploymentUserId = siteAutopilotUser();
  const [rows, deploymentRows] = await Promise.all([
    sql<{ user_id: string; repo: string; created_at: Date | null; updated_at: Date | null }[]>`
      select user_id, repo, created_at, updated_at from kismet.autopilot_repo
      where lower(repo) = lower(${repo.trim()})
    `,
    deploymentUserId
      ? sql<{ repo: string }[]>`select repo from kismet.autopilot_repo where user_id = ${deploymentUserId} limit 1`
      : Promise.resolve([]),
  ]);
  const explicitDeploymentRepo = deploymentRows[0]?.repo?.trim();
  return repositoryOwner({
    repo,
    candidates: rows.map((row) => ({
      userId: row.user_id,
      repo: row.repo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    deploymentUserId,
    deploymentRepo: explicitDeploymentRepo || (deploymentUserId ? defaultRepo() : null),
  });
}
