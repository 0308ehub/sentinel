import "server-only";

import { parseBuilder, type Builder } from "@/lib/autopilot/builders";
import { db } from "@/lib/autopilot/db";
import { actingUserId } from "@/lib/connections/current";
import { getConnection } from "@/lib/connections/store";

/** The coding agent the running loop's account, or the signed-in account, chose. Kismet's own by default. */
export async function accountBuilder(): Promise<Builder> {
  const userId = await actingUserId();
  if (!userId) return "kismet";
  const sql = await db();
  const rows = await sql<{ builder: string }[]>`
    select builder from kismet.autopilot_builder where user_id = ${userId} limit 1
  `;
  return parseBuilder(rows[0]?.builder);
}

export async function setAccountBuilder(userId: string, builder: Builder): Promise<void> {
  const sql = await db();
  await sql`
    insert into kismet.autopilot_builder (user_id, builder)
    values (${userId}, ${builder})
    on conflict (user_id) do update set builder = excluded.builder, updated_at = now()
  `;
}

/** The account's Cursor API key, or "" when it has not added one. */
export async function cursorKey(userId: string): Promise<string> {
  const connection = await getConnection<{ key?: unknown }>(userId, "cursor");
  return typeof connection?.secret.key === "string" ? connection.secret.key.trim() : "";
}
