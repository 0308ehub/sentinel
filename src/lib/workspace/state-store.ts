import "server-only";

import type postgres from "postgres";
import { db } from "@/lib/autopilot/db";

export type StateKey = "graph" | "chats";

export const STATE_KEYS: StateKey[] = ["graph", "chats"];

export function isStateKey(value: unknown): value is StateKey {
  return typeof value === "string" && STATE_KEYS.includes(value as StateKey);
}

interface StateRow {
  key: StateKey;
  data: unknown;
  version: number;
}

export async function loadStates(
  userId: string,
): Promise<Partial<Record<StateKey, { data: unknown; version: number }>>> {
  const sql = await db();
  const rows = await sql<StateRow[]>`
    select key, data, version from kismet.workspace_state
    where user_id = ${userId} and key in ${sql(STATE_KEYS)}
  `;
  return Object.fromEntries(rows.map((row) => [row.key, { data: row.data, version: row.version }]));
}

export async function saveState(
  userId: string,
  key: StateKey,
  data: unknown,
  baseVersion: number,
): Promise<{ ok: true; version: number } | { ok: false; data: unknown; version: number }> {
  const sql = await db();
  const rows = await sql<{ version: number }[]>`
    insert into kismet.workspace_state (user_id, key, data, version)
    values (${userId}, ${key}, ${sql.json(data as postgres.JSONValue)}, 1)
    on conflict (user_id, key) do update
    set data = excluded.data,
        version = kismet.workspace_state.version + 1,
        updated_at = now()
    where kismet.workspace_state.version = ${baseVersion}
    returning version
  `;
  if (rows[0]) return { ok: true, version: rows[0].version };
  const current = await sql<{ data: unknown; version: number }[]>`
    select data, version from kismet.workspace_state
    where user_id = ${userId} and key = ${key}
    limit 1
  `;
  return { ok: false, data: current[0]?.data ?? {}, version: current[0]?.version ?? 0 };
}
