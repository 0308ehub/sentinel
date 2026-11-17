import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { BetaManagedAgentsSessionEvent } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import { db } from "@/lib/autopilot/db";
import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { getConnection } from "@/lib/connections/store";
import { toCoderView, type CoderView } from "@/lib/coder/view";

export const SESSION_BUDGET_CENTS = "500";
export const DAILY_LIMIT = 10;
const CONNECT_MESSAGE = "Connect GitHub and choose a repository first. Visit /settings/connectors/github.";

export class CoderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function coderConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() &&
    process.env.KISMET_CODER_AGENT_ID?.trim() &&
    process.env.KISMET_CODER_ENVIRONMENT_ID?.trim(),
  );
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export interface CoderSessionRow {
  sessionId: string;
  repo: string;
  title: string;
}

export async function coderSessionRow(userId: string, sessionId: string): Promise<CoderSessionRow> {
  const sql = await db();
  const rows = await sql<{ session_id: string; repo: string; title: string }[]>`
    select session_id, repo, title from kismet.coder_sessions
    where session_id = ${sessionId} and user_id = ${userId} limit 1
  `;
  const row = rows[0];
  if (!row) throw new CoderError("Coding session not found.", 404);
  return { sessionId: row.session_id, repo: row.repo, title: row.title };
}

async function listEvents(sessionId: string): Promise<BetaManagedAgentsSessionEvent[]> {
  const events: BetaManagedAgentsSessionEvent[] = [];
  for await (const event of client().beta.sessions.events.list(sessionId, { limit: 1000 })) {
    events.push(event);
    if (events.length >= 3000) break;
  }
  return events;
}

export async function startCoderSession(userId: string, text: string): Promise<CoderSessionRow> {
  const connection = await getConnection<{ token?: unknown }>(userId, "github");
  const githubToken = typeof connection?.secret.token === "string" ? connection.secret.token.trim() : "";
  const repo = await withAutopilotUser(userId, chosenAutopilotRepo);
  if (!githubToken || !repo) throw new CoderError(CONNECT_MESSAGE, 409);
  const sql = await db();
  const count = await sql<{ count: number }[]>`
    select count(*)::int as count from kismet.coder_sessions
    where user_id = ${userId} and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
  `;
  if ((count[0]?.count ?? 0) >= DAILY_LIMIT) throw new CoderError("Daily coding session limit reached. Try again tomorrow.", 429);
  const title = text.replace(/\s+/g, " ").trim().slice(0, 80);
  const session = await client().beta.sessions.create({
    agent: process.env.KISMET_CODER_AGENT_ID!,
    environment_id: process.env.KISMET_CODER_ENVIRONMENT_ID!,
    title,
    budget: { type: "limit", max_list_cost: { amount: SESSION_BUDGET_CENTS, currency: "USD" } },
    metadata: { kismet_user: userId },
    resources: [{
      type: "github_repository",
      url: `https://github.com/${repo}`,
      authorization_token: githubToken,
      mount_path: "/workspace/repo",
    }],
    initial_events: [{ type: "user.message", content: [{ type: "text", text }] }],
  });
  await sql`
    insert into kismet.coder_sessions (session_id, user_id, repo, title)
    values (${session.id}, ${userId}, ${repo}, ${title})
  `;
  return { sessionId: session.id, repo, title };
}

export async function coderSessionView(userId: string, sessionId: string): Promise<CoderView> {
  await coderSessionRow(userId, sessionId);
  const sdk = client();
  const [session, events] = await Promise.all([sdk.beta.sessions.retrieve(sessionId), listEvents(sessionId)]);
  return toCoderView(events, session);
}

export async function sendCoderMessage(userId: string, sessionId: string, text: string): Promise<void> {
  await coderSessionRow(userId, sessionId);
  const view = await coderSessionView(userId, sessionId);
  if (view.stopReason === "requires_action") throw new CoderError("Answer the pending step first.", 409);
  await client().beta.sessions.events.send(sessionId, {
    events: [{ type: "user.message", content: [{ type: "text", text }] }],
  });
}

export async function confirmCoderTool(
  userId: string,
  sessionId: string,
  toolUseId: string,
  allow: boolean,
): Promise<void> {
  await coderSessionRow(userId, sessionId);
  await client().beta.sessions.events.send(sessionId, {
    events: [{
      type: "user.tool_confirmation",
      tool_use_id: toolUseId,
      result: allow ? "allow" : "deny",
      ...(!allow ? { deny_message: "The user denied this action." } : {}),
    }],
  });
}

export async function interruptCoderSession(userId: string, sessionId: string): Promise<void> {
  await coderSessionRow(userId, sessionId);
  await client().beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] });
}

export function coderError(error: unknown): { message: string; status: number } {
  if (error instanceof CoderError) return { message: error.message, status: error.status };
  if (error instanceof Anthropic.RateLimitError) return { message: "The coding agent is busy. Try again shortly.", status: 429 };
  if (error instanceof Anthropic.AuthenticationError) return { message: "The coding agent is not configured correctly.", status: 503 };
  if (error instanceof Anthropic.APIError) return { message: "The coding agent request failed. Try again.", status: 502 };
  return { message: "The coding agent request failed. Try again.", status: 500 };
}
