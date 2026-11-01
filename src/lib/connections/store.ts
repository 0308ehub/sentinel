import "server-only";

import type postgres from "postgres";
import { db } from "@/lib/autopilot/db";
import { decrypt, encrypt } from "@/lib/connections/crypto";

export type Provider = "slack" | "jira" | "databricks" | "github" | "google";

export async function getConnection<T>(
  userId: string,
  provider: Provider,
): Promise<{ secret: T; meta: Record<string, unknown> } | null> {
  const sql = await db();
  const rows = await sql<{ secret: string; meta: Record<string, unknown> }[]>`
    select secret, meta from kismet.connections
    where user_id = ${userId} and provider = ${provider}
    limit 1
  `;
  const row = rows[0];
  return row ? { secret: decrypt<T>(row.secret), meta: row.meta ?? {} } : null;
}

export async function saveConnection(
  userId: string,
  provider: Provider,
  secret: unknown,
  meta: Record<string, unknown>,
): Promise<void> {
  const sql = await db();
  await sql`
    insert into kismet.connections (user_id, provider, secret, meta)
    values (${userId}, ${provider}, ${encrypt(secret)}, ${sql.json(meta as postgres.JSONValue)})
    on conflict (user_id, provider) do update
    set secret = excluded.secret, meta = excluded.meta, updated_at = now()
  `;
}

export async function deleteConnection(userId: string, provider: Provider): Promise<void> {
  const sql = await db();
  await sql`delete from kismet.connections where user_id = ${userId} and provider = ${provider}`;
}
