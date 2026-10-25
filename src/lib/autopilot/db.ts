import "server-only";

import postgres from "postgres";

type Sql = postgres.Sql;

const globalForSql = globalThis as unknown as { kismetSql?: Sql; kismetReady?: Promise<void> };

function databaseUrl(): string {
  const url = process.env.KISMET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Set KISMET_DATABASE_URL (or DATABASE_URL) so Autopilot can store its work.");
  return url;
}

export function autopilotConfigured(): boolean {
  return Boolean(process.env.KISMET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function client(): Sql {
  if (!globalForSql.kismetSql) {
    const url = databaseUrl();
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalForSql.kismetSql = postgres(url, {
      max: 5,
      ssl: local ? false : "require",
      onnotice: () => {},
      connection: { search_path: "kismet" },
    });
  }
  return globalForSql.kismetSql;
}

// Everything lives in its own schema so the shared Neon database's other tables are never touched.
const SCHEMA = `
create schema if not exists kismet;

create table if not exists kismet.evidence (
  id text primary key,
  source text not null,
  synthetic boolean not null default false,
  title text not null,
  body text not null default '',
  author text not null default '',
  url text,
  occurred_at timestamptz not null default now(),
  signal_id text,
  created_at timestamptz not null default now()
);
create index if not exists evidence_signal_idx on kismet.evidence (signal_id);

create table if not exists kismet.signals (
  id text primary key,
  title text not null,
  problem text not null default '',
  area text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kismet.experiments (
  id text primary key,
  signal_id text not null,
  version integer not null default 1,
  title text not null,
  hypothesis text not null default '',
  metric text not null default '',
  guardrail text not null default '',
  control text not null default '',
  treatment text not null default '',
  flag text not null unique,
  status text not null,
  pr_url text,
  pr_number integer,
  branch text,
  note text,
  readout jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
alter table kismet.experiments add column if not exists metric_spec jsonb;
alter table kismet.experiments add column if not exists draft_path text;
alter table kismet.experiments add column if not exists draft text;

create table if not exists kismet.flags (
  key text primary key,
  status text not null default 'off',
  treatment_pct integer not null default 50,
  updated_at timestamptz not null default now()
);

create table if not exists kismet.events (
  id bigserial primary key,
  at timestamptz not null default now(),
  visitor text not null,
  name text not null,
  page text not null default '',
  element text not null default '',
  arms jsonb not null default '{}'::jsonb,
  synthetic boolean not null default false
);
create index if not exists events_name_idx on kismet.events (name, element);

create table if not exists kismet.activity (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,
  message text not null,
  ref text
);
`;

export async function db(): Promise<Sql> {
  const sql = client();
  if (!globalForSql.kismetReady) {
    globalForSql.kismetReady = sql.unsafe(SCHEMA).then(() => undefined);
    globalForSql.kismetReady.catch(() => {
      globalForSql.kismetReady = undefined;
    });
  }
  await globalForSql.kismetReady;
  return sql;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
