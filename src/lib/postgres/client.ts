import "server-only";

import postgres from "postgres";
import { autopilotConfigured } from "@/lib/autopilot/db";
import { currentUserId } from "@/lib/connections/current";
import { deleteConnection, getConnection, saveConnection } from "@/lib/connections/store";
import { pooledDatabase } from "@/lib/db/url";
import { databaseLabel, postgresUrl } from "@/lib/postgres/url";

export interface PostgresTable {
  schema: string;
  name: string;
}

export interface PostgresStatus {
  configured: boolean;
  connected: boolean;
  database?: string;
  host?: string;
  tables?: PostgresTable[];
  error?: string;
}

interface SavedSecret {
  url?: string;
}

const NEEDS_APP_DB = "Add the Supabase connection string on the deploy before connecting a database.";
let cache: { at: number; userId: string; status: PostgresStatus } | null = null;

export async function getPostgresStatus(): Promise<PostgresStatus> {
  if (!autopilotConfigured()) return { configured: false, connected: false, error: NEEDS_APP_DB };
  const userId = await currentUserId();
  if (!userId) return { configured: true, connected: false, error: "Sign in required." };
  if (cache && cache.userId === userId && Date.now() - cache.at < 60_000) return cache.status;
  const saved = await getConnection<SavedSecret>(userId, "postgres").catch(() => null);
  const url = saved?.secret.url ? postgresUrl(saved.secret.url) : null;
  if (!url) return { configured: true, connected: false };
  const status = await probe(url);
  cache = { at: Date.now(), userId, status };
  return status;
}

export async function connectPostgres(rawUrl: string): Promise<PostgresStatus> {
  if (!autopilotConfigured()) return { configured: false, connected: false, error: NEEDS_APP_DB };
  const userId = await currentUserId();
  if (!userId) return { configured: true, connected: false, error: "Sign in required." };
  const url = postgresUrl(rawUrl);
  if (!url) return { configured: true, connected: false, error: "Paste a postgres:// connection URL, including the database name." };
  const status = await probe(url);
  if (!status.connected) return status;
  await saveConnection(userId, "postgres", { url }, { database: status.database ?? "", host: status.host ?? "" });
  cache = { at: Date.now(), userId, status };
  return status;
}

export async function disconnectPostgres(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await deleteConnection(userId, "postgres");
  cache = null;
}

export async function postgresBrief(): Promise<string> {
  const status = await getPostgresStatus().catch(() => null);
  if (!status?.connected || !status.database) return "";
  const tables = (status.tables ?? []).map((table) => `${table.schema}.${table.name}`).join(", ");
  return [
    `Postgres is connected. Database ${status.database}.`,
    tables ? `Tables: ${tables}.` : "No tables were listed.",
    "This connection is read only. Do not invent tables or columns that are not named here.",
  ].join(" ");
}

async function probe(url: string): Promise<PostgresStatus> {
  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(url);
  const sql = postgres(url, {
    max: 1,
    ssl: local ? false : "require",
    prepare: pooledDatabase(url) ? false : true,
    connect_timeout: 8,
    idle_timeout: 1,
    onnotice: () => {},
  });
  try {
    await sql`set default_transaction_read_only = on`.catch(() => undefined);
    const info = await sql<{ name: string }[]>`select current_database() as name`;
    const tables = await sql<{ schema: string; name: string }[]>`
      select table_schema as schema, table_name as name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('pg_catalog', 'information_schema', 'kismet')
      order by table_schema, table_name
      limit 12
    `.catch(() => []);
    return {
      configured: true,
      connected: true,
      database: info[0]?.name || databaseLabel(url),
      host: new URL(url).hostname,
      tables: tables.map((table) => ({ schema: table.schema, name: table.name })),
    };
  } catch (error) {
    return { configured: true, connected: false, error: safeMessage(error) };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Could not connect to that database.";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://…").slice(0, 240);
}
