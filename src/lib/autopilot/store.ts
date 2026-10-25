import "server-only";

import { db, newId } from "@/lib/autopilot/db";
import {
  READY_MIN_EVIDENCE,
  READY_MIN_SOURCES,
  type Activity,
  type Evidence,
  type EvidenceSource,
  type Experiment,
  type ExperimentStatus,
  type Readout,
  type Signal,
  type SignalStatus,
} from "@/lib/autopilot/types";

type Row = Record<string, unknown>;

const iso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value));
const isoOrNull = (value: unknown): string | null => (value == null ? null : iso(value));

function toEvidence(row: Row): Evidence {
  return {
    id: String(row.id),
    source: row.source as EvidenceSource,
    synthetic: Boolean(row.synthetic),
    title: String(row.title),
    body: String(row.body ?? ""),
    author: String(row.author ?? ""),
    url: (row.url as string | null) ?? null,
    occurredAt: iso(row.occurred_at),
    signalId: (row.signal_id as string | null) ?? null,
  };
}

function toExperiment(row: Row): Experiment {
  return {
    id: String(row.id),
    signalId: String(row.signal_id),
    version: Number(row.version),
    title: String(row.title),
    hypothesis: String(row.hypothesis ?? ""),
    metric: String(row.metric ?? ""),
    guardrail: String(row.guardrail ?? ""),
    control: String(row.control ?? ""),
    treatment: String(row.treatment ?? ""),
    flag: String(row.flag),
    status: row.status as ExperimentStatus,
    prUrl: (row.pr_url as string | null) ?? null,
    prNumber: row.pr_number == null ? null : Number(row.pr_number),
    note: (row.note as string | null) ?? null,
    readout: (row.readout as Readout | null) ?? null,
    createdAt: iso(row.created_at),
    startedAt: isoOrNull(row.started_at),
    endedAt: isoOrNull(row.ended_at),
  };
}

export interface NewEvidence {
  source: EvidenceSource;
  synthetic: boolean;
  title: string;
  body: string;
  author: string;
  url?: string | null;
  occurredAt?: string;
}

export async function addEvidence(items: NewEvidence[]): Promise<number> {
  if (items.length === 0) return 0;
  const sql = await db();
  const rows = items.map((item) => ({
    id: newId("ev"),
    source: item.source,
    synthetic: item.synthetic,
    title: item.title.slice(0, 300),
    body: item.body.slice(0, 4000),
    author: item.author.slice(0, 120),
    url: item.url ?? null,
    occurred_at: item.occurredAt ?? new Date().toISOString(),
  }));
  await sql`insert into kismet.evidence ${sql(rows)}`;
  return rows.length;
}

export async function unassignedEvidence(limit: number): Promise<Evidence[]> {
  const sql = await db();
  const rows = await sql`
    select * from kismet.evidence where signal_id is null order by occurred_at asc limit ${limit}
  `;
  return rows.map(toEvidence);
}

export async function createSignal(input: { title: string; problem: string; area: string }): Promise<string> {
  const sql = await db();
  const id = newId("sig");
  await sql`
    insert into kismet.signals (id, title, problem, area)
    values (${id}, ${input.title.slice(0, 200)}, ${input.problem.slice(0, 1000)}, ${input.area.slice(0, 120)})
  `;
  return id;
}

export async function assignEvidence(signalId: string, evidenceIds: string[]): Promise<void> {
  if (evidenceIds.length === 0) return;
  const sql = await db();
  await sql`update kismet.evidence set signal_id = ${signalId} where id in ${sql(evidenceIds)} and signal_id is null`;
  await sql`update kismet.signals set updated_at = now() where id = ${signalId}`;
}

export async function setSignalStatus(id: string, status: SignalStatus): Promise<void> {
  const sql = await db();
  await sql`update kismet.signals set status = ${status}, updated_at = now() where id = ${id}`;
}

export async function listSignals(): Promise<Signal[]> {
  const sql = await db();
  const signals = await sql`select * from kismet.signals order by updated_at desc limit 200`;
  const evidence = await sql`
    select * from kismet.evidence where signal_id is not null order by occurred_at desc limit 2000
  `;
  const bySignal = new Map<string, Evidence[]>();
  for (const row of evidence) {
    const item = toEvidence(row);
    const list = bySignal.get(item.signalId!) ?? [];
    list.push(item);
    bySignal.set(item.signalId!, list);
  }
  return signals
    .map((row) => {
      const items = bySignal.get(String(row.id)) ?? [];
      const sources = [...new Set(items.map((item) => item.source))];
      return {
        id: String(row.id),
        title: String(row.title),
        problem: String(row.problem ?? ""),
        area: String(row.area ?? ""),
        status: row.status as SignalStatus,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        evidence: items,
        sources,
        ready: items.length >= READY_MIN_EVIDENCE && sources.length >= READY_MIN_SOURCES,
      };
    })
    .sort((a, b) => b.evidence.length - a.evidence.length);
}

export async function listExperiments(): Promise<Experiment[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.experiments order by created_at desc limit 100`;
  return rows.map(toExperiment);
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  const sql = await db();
  const rows = await sql`select * from kismet.experiments where id = ${id}`;
  return rows[0] ? toExperiment(rows[0]) : null;
}

export async function createExperiment(input: {
  signalId: string;
  version: number;
  title: string;
  hypothesis: string;
  metric: string;
  guardrail: string;
  control: string;
  treatment: string;
  flag: string;
}): Promise<string> {
  const sql = await db();
  const id = newId("exp");
  await sql`
    insert into kismet.experiments
      (id, signal_id, version, title, hypothesis, metric, guardrail, control, treatment, flag, status)
    values
      (${id}, ${input.signalId}, ${input.version}, ${input.title.slice(0, 200)}, ${input.hypothesis.slice(0, 1000)},
       ${input.metric.slice(0, 120)}, ${input.guardrail.slice(0, 300)}, ${input.control.slice(0, 500)},
       ${input.treatment.slice(0, 500)}, ${input.flag}, 'building')
  `;
  return id;
}

export async function updateExperiment(
  id: string,
  patch: Partial<{
    status: ExperimentStatus;
    prUrl: string | null;
    prNumber: number | null;
    branch: string | null;
    note: string | null;
    readout: Readout | null;
    startedAt: string | null;
    endedAt: string | null;
  }>
): Promise<void> {
  const sql = await db();
  const columns: Row = {};
  if (patch.status !== undefined) columns.status = patch.status;
  if (patch.prUrl !== undefined) columns.pr_url = patch.prUrl;
  if (patch.prNumber !== undefined) columns.pr_number = patch.prNumber;
  if (patch.branch !== undefined) columns.branch = patch.branch;
  if (patch.note !== undefined) columns.note = patch.note;
  if (patch.readout !== undefined) columns.readout = patch.readout === null ? null : sql.json(patch.readout as never);
  if (patch.startedAt !== undefined) columns.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) columns.ended_at = patch.endedAt;
  if (Object.keys(columns).length === 0) return;
  await sql`update kismet.experiments set ${sql(columns)} where id = ${id}`;
}

export async function log(kind: string, message: string, ref?: string): Promise<void> {
  const sql = await db();
  await sql`insert into kismet.activity (kind, message, ref) values (${kind}, ${message.slice(0, 500)}, ${ref ?? null})`;
}

export async function listActivity(limit = 40): Promise<Activity[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.activity order by id desc limit ${limit}`;
  return rows.map((row) => ({
    id: Number(row.id),
    at: iso(row.at),
    kind: String(row.kind),
    message: String(row.message),
    ref: (row.ref as string | null) ?? null,
  }));
}

export async function lastRunAt(): Promise<string | null> {
  const sql = await db();
  const rows = await sql`select max(at) as at from kismet.activity where kind = 'tick'`;
  return isoOrNull(rows[0]?.at);
}

export async function evidenceCounts(sinceDays: number): Promise<{ total: number; real: number }> {
  const sql = await db();
  const rows = await sql`
    select count(*)::int as total, count(*) filter (where not synthetic)::int as real
    from kismet.evidence where occurred_at > now() - make_interval(days => ${sinceDays})
  `;
  return { total: Number(rows[0]?.total ?? 0), real: Number(rows[0]?.real ?? 0) };
}

/** Runs fn only if no other tick holds the lock, so overlapping cron and button runs never double-act. */
export async function withTickLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const sql = await db();
  return sql.reserve().then(async (conn) => {
    try {
      const [{ locked }] = await conn`select pg_try_advisory_lock(424242) as locked`;
      if (!locked) return null;
      try {
        return await fn();
      } finally {
        await conn`select pg_advisory_unlock(424242)`;
      }
    } finally {
      conn.release();
    }
  });
}
