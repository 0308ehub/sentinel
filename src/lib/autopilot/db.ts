import "server-only";

import postgres from "postgres";
import { resolveDatabaseUrl } from "@/lib/db/url";

type Sql = postgres.Sql;

const globalForSql = globalThis as unknown as { kismetSql?: Sql; kismetReady?: Promise<void> };

function databaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("Set DATABASE_URL to the Supabase connection string.");
  return url;
}

export function autopilotConfigured(): boolean {
  return Boolean(resolveDatabaseUrl());
}

function client(): Sql {
  if (!globalForSql.kismetSql) {
    const url = databaseUrl();
    const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(url);
    globalForSql.kismetSql = postgres(url, {
      max: 5,
      ssl: local ? false : "require",
      // No cached prepared statements: a deploy that adds columns would otherwise break every
      // `select *` another instance had cached ("cached plan must not change result type").
      prepare: false,
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
alter table kismet.experiments add column if not exists original text;
alter table kismet.experiments add column if not exists page text;
alter table kismet.experiments add column if not exists overlap text;
alter table kismet.experiments add column if not exists cleanup_status text;
alter table kismet.experiments add column if not exists cleanup_pr_url text;
alter table kismet.experiments add column if not exists cleanup_pr_number integer;
alter table kismet.experiments add column if not exists cleanup_draft text;
alter table kismet.experiments add column if not exists cleanup_note text;
alter table kismet.experiments add column if not exists coder_session_id text;
alter table kismet.experiments add column if not exists agent_failed boolean not null default false;
create index if not exists experiments_coder_session_idx on kismet.experiments (coder_session_id);
-- A change written by the account's own coding agent (Cursor or Claude Code) instead of Kismet's.
alter table kismet.experiments add column if not exists builder text;
alter table kismet.experiments add column if not exists build_ref text;
alter table kismet.experiments add column if not exists build_url text;
alter table kismet.experiments add column if not exists build_started_at timestamptz;
alter table kismet.experiments add column if not exists estimate jsonb;
alter table kismet.experiments add column if not exists rejected_by text;
alter table kismet.experiments add column if not exists change_summary jsonb;
alter table kismet.signals add column if not exists snoozed_until timestamptz;

create table if not exists kismet.autopilot_learnings (
  id text primary key,
  user_id text not null,
  experiment_id text not null,
  signal_id text,
  kind text not null,
  outcome text not null,
  title text,
  page text,
  metric text,
  change text,
  lift float8,
  p_value float8,
  visitors int,
  learning text not null,
  created_at timestamptz default now(),
  unique (user_id, experiment_id)
);
create index if not exists autopilot_learnings_user_created_idx on kismet.autopilot_learnings (user_id, created_at desc);

create table if not exists kismet.autopilot_goals (
  id text primary key,
  user_id text not null,
  name text not null,
  spec jsonb not null,
  source text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists autopilot_goals_user_idx on kismet.autopilot_goals (user_id, archived, created_at);

create table if not exists kismet.flags (
  key text primary key,
  status text not null default 'off',
  treatment_pct integer not null default 50,
  updated_at timestamptz not null default now()
);
alter table kismet.flags add column if not exists layer text;
alter table kismet.flags add column if not exists slot_start integer not null default 0;
alter table kismet.flags add column if not exists slot_end integer not null default 100;
alter table kismet.flags add column if not exists user_id text not null default '';

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
alter table kismet.events add column if not exists user_id text not null default '';

create table if not exists kismet.activity (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,
  message text not null,
  ref text
);
alter table kismet.activity add column if not exists user_id text not null default '';
alter table kismet.evidence add column if not exists user_id text not null default '';
alter table kismet.signals add column if not exists user_id text not null default '';
alter table kismet.experiments add column if not exists user_id text not null default '';

create index if not exists evidence_user_idx on kismet.evidence (user_id);
create index if not exists signals_user_idx on kismet.signals (user_id);
create index if not exists experiments_user_idx on kismet.experiments (user_id);
create index if not exists events_user_idx on kismet.events (user_id, at);
create index if not exists activity_user_idx on kismet.activity (user_id, id desc);
create unique index if not exists flags_user_key on kismet.flags (user_id, key);
create unique index if not exists experiments_user_flag on kismet.experiments (user_id, flag);

create table if not exists kismet.feedback (
  id text primary key,
  user_id text not null,
  message text not null,
  page text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_user_created_idx on kismet.feedback (user_id, created_at desc);

-- Flag names used to be unique across the whole product. Each account can now reuse one.
do $$
declare row record;
begin
  for row in
    select rel.relname as table_name, con.conname as constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'kismet'
      and (
        (rel.relname = 'flags' and con.contype = 'p')
        or (rel.relname = 'experiments' and con.contype = 'u' and pg_get_constraintdef(con.oid) = 'UNIQUE (flag)')
      )
  loop
    execute format('alter table kismet.%I drop constraint %I', row.table_name, row.constraint_name);
  end loop;
end $$;

create table if not exists kismet.autopilot_repo (
  user_id text primary key,
  repo text not null,
  updated_at timestamptz not null default now()
);

-- Which coding agent writes an account's experiments. No row means Kismet's own.
create table if not exists kismet.autopilot_builder (
  user_id text primary key,
  builder text not null,
  updated_at timestamptz not null default now()
);

-- One row per Slack mention, so accounts sharing a bot never both act on it.
create table if not exists kismet.slack_mention_claims (
  mention_key text primary key,
  user_id text not null,
  claimed_at timestamptz not null default now()
);

create table if not exists kismet.autopilot_sites (
  user_id text primary key,
  site_key text not null unique,
  created_at timestamptz not null default now()
);
alter table kismet.autopilot_sites add column if not exists site_url text;

create table if not exists kismet.connections (
  user_id text not null,
  provider text not null,
  secret text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, provider)
);

create table if not exists kismet.slack_mentions (
  user_id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists kismet.inbox_agents (
  id text primary key,
  user_id text not null,
  slug text not null,
  name text not null,
  icon text not null default '',
  color text not null default '#0571d3',
  instructions text not null default '',
  pinned boolean not null default false,
  muted boolean not null default false,
  ignored_streak integer not null default 0,
  spec text not null default '',
  boost real not null default 1,
  created_at timestamptz not null default now()
);
create unique index if not exists inbox_agents_user_slug on kismet.inbox_agents (user_id, slug);

create table if not exists kismet.inbox_threads (
  id text primary key,
  user_id text not null,
  key text not null,
  kind text not null default 'direct',
  title text not null default '',
  pinned boolean not null default false,
  pin_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create unique index if not exists inbox_threads_user_key on kismet.inbox_threads (user_id, key);

create table if not exists kismet.inbox_removed (
  user_id text not null,
  slug text not null,
  primary key (user_id, slug)
);

create table if not exists kismet.inbox_members (
  thread_id text not null,
  agent_id text not null,
  primary key (thread_id, agent_id)
);

create table if not exists kismet.inbox_messages (
  id text primary key,
  thread_id text not null,
  user_id text not null,
  agent_id text,
  sender text not null,
  type text not null,
  body text not null default '',
  signal_id text,
  reply_to text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists inbox_messages_thread_idx on kismet.inbox_messages (thread_id, created_at);

create table if not exists kismet.inbox_findings (
  id text primary key,
  user_id text not null,
  agent_id text not null,
  type text not null,
  semantic_key text not null,
  title text not null,
  summary text not null default '',
  hypothesis text not null default '',
  proposed_action text not null default '',
  intro text not null default '',
  activity text not null default '',
  confidence double precision not null,
  impact double precision not null,
  urgency double precision not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  tier text,
  score double precision,
  explanation text not null default '',
  snooze_until timestamptz,
  source_run_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists inbox_findings_user_key on kismet.inbox_findings (user_id, semantic_key);

create table if not exists kismet.inbox_finding_events (
  id bigserial primary key,
  finding_id text not null,
  user_id text not null,
  kind text not null,
  detail text not null default '',
  at timestamptz not null default now()
);

create table if not exists kismet.inbox_status (
  user_id text not null,
  agent_id text not null,
  activity text not null default '',
  run_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_id)
);

create table if not exists kismet.inbox_prefs (
  user_id text primary key,
  mode text not null default 'session',
  work_start integer not null default 9,
  work_end integer not null default 18,
  tz_offset integer not null default 0,
  idle_hours double precision not null default 2,
  session_cap integer not null default 4,
  daily_interrupt_budget integer not null default 3,
  slack_interrupts boolean not null default false,
  slack_channel text not null default '',
  last_meaningful_at timestamptz,
  session_open_until timestamptz,
  interrupts_today integer not null default 0,
  interrupts_day text not null default ''
);

create table if not exists kismet.ai_spend (
  bucket text not null,
  subject text not null,
  cents integer not null default 0,
  hits integer not null default 0,
  primary key (bucket, subject)
);

create table if not exists kismet.workspace (
  id text primary key,
  graph jsonb,
  graph_at timestamptz,
  chat jsonb,
  chat_at timestamptz,
  notes jsonb not null default '[]'::jsonb,
  notes_at timestamptz
);

create table if not exists kismet.inbox_weights (
  user_id text not null,
  signal_type text not null,
  weight double precision not null default 1,
  autonomy text not null default 'NOTIFY_ONLY',
  primary key (user_id, signal_type)
);

create table if not exists kismet.workspace_state (
  user_id text not null,
  key text not null,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists kismet.coder_sessions (
  session_id text primary key,
  user_id text not null,
  repo text not null,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists coder_sessions_user_created_idx on kismet.coder_sessions (user_id, created_at desc);

create table if not exists kismet.experiment_snapshots (
  id text primary key,
  user_id text not null,
  experiment_id text not null,
  sha text not null,
  status text not null,
  session_id text,
  scenario text,
  control_html text,
  treatment_html text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, experiment_id, sha)
);
alter table kismet.experiment_snapshots add column if not exists used_recipe boolean not null default false;
create index if not exists experiment_snapshots_session_idx on kismet.experiment_snapshots (session_id);
create index if not exists experiment_snapshots_user_created_idx on kismet.experiment_snapshots (user_id, created_at desc);
create unique index if not exists experiment_snapshots_one_rendering_per_user
  on kismet.experiment_snapshots (user_id) where status = 'rendering';

create table if not exists kismet.render_recipes (
  user_id text not null,
  repo text not null,
  recipe text not null,
  script text,
  updated_at timestamptz default now(),
  primary key (user_id, repo)
);

create table if not exists kismet.webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
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
