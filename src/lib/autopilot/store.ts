import "server-only";

import { db, newId } from "@/lib/autopilot/db";
import { autopilotUser } from "@/lib/autopilot/scope";
import { parseMetricSpec, type Arm, type FlagState, type MetricSpec } from "@/lib/autopilot/assign";
import { isOutsideBuilder, type OutsideBuilder } from "@/lib/autopilot/builders";
import {
  READY_MIN_EVIDENCE,
  READY_MIN_SOURCES,
  type Activity,
  type CleanupStatus,
  type Evidence,
  type EvidenceSource,
  type Experiment,
  type ExperimentStatus,
  type Readout,
  type Signal,
  type SignalStatus,
} from "@/lib/autopilot/types";

type Row = Record<string, unknown>;

function scopeUser(): string {
  return autopilotUser();
}

/** Rows written before accounts were split belong to the deployment owner. */
export async function claimLegacyRows(userId: string): Promise<void> {
  const named = process.env.KISMET_AUTOPILOT_USER_ID?.trim();
  const owner = named || (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NODE_ENV !== "production" ? "local" : "");
  if (!owner || userId !== owner) return;
  const sql = await db();
  await sql`update kismet.evidence set user_id = ${userId} where user_id = ''`;
  await sql`update kismet.signals set user_id = ${userId} where user_id = ''`;
  await sql`update kismet.experiments set user_id = ${userId} where user_id = ''`;
  await sql`update kismet.flags set user_id = ${userId} where user_id = ''`;
  await sql`update kismet.events set user_id = ${userId} where user_id = ''`;
  await sql`update kismet.activity set user_id = ${userId} where user_id = ''`;
}

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
    metricSpec: parseMetricSpec(row.metric_spec),
    page: String(row.page ?? ""),
    overlap: (row.overlap as string | null) ?? null,
    guardrail: String(row.guardrail ?? ""),
    control: String(row.control ?? ""),
    treatment: String(row.treatment ?? ""),
    flag: String(row.flag),
    status: row.status as ExperimentStatus,
    branch: (row.branch as string | null) ?? null,
    prUrl: (row.pr_url as string | null) ?? null,
    prNumber: row.pr_number == null ? null : Number(row.pr_number),
    note: (row.note as string | null) ?? null,
    readout: (row.readout as Readout | null) ?? null,
    draftPath: (row.draft_path as string | null) ?? null,
    coderSessionId: (row.coder_session_id as string | null) ?? null,
    agentFailed: Boolean(row.agent_failed),
    builder: isOutsideBuilder(row.builder) ? row.builder : null,
    buildRef: (row.build_ref as string | null) ?? null,
    buildUrl: (row.build_url as string | null) ?? null,
    buildStartedAt: isoOrNull(row.build_started_at),
    cleanup: row.cleanup_status
      ? {
          status: row.cleanup_status as CleanupStatus,
          keep: row.status === "rolled_out" ? "treatment" : "control",
          prUrl: (row.cleanup_pr_url as string | null) ?? null,
          prNumber: row.cleanup_pr_number == null ? null : Number(row.cleanup_pr_number),
          note: (row.cleanup_note as string | null) ?? null,
        }
      : null,
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
  const userId = scopeUser();
  const rows = items.map((item) => ({
    id: newId("ev"),
    user_id: userId,
    source: item.source,
    synthetic: item.synthetic,
    title: item.title.slice(0, 300),
    body: item.body.slice(0, 8000),
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
    select * from kismet.evidence where user_id = ${scopeUser()} and signal_id is null order by occurred_at asc limit ${limit}
  `;
  return rows.map(toEvidence);
}

export async function createSignal(input: { title: string; problem: string; area: string }): Promise<string> {
  const sql = await db();
  const id = newId("sig");
  await sql`
    insert into kismet.signals (id, user_id, title, problem, area)
    values (${id}, ${scopeUser()}, ${input.title.slice(0, 200)}, ${input.problem.slice(0, 1000)}, ${input.area.slice(0, 120)})
  `;
  return id;
}

export async function assignEvidence(signalId: string, evidenceIds: string[]): Promise<void> {
  if (evidenceIds.length === 0) return;
  const sql = await db();
  const userId = scopeUser();
  await sql`update kismet.evidence set signal_id = ${signalId} where user_id = ${userId} and id in ${sql(evidenceIds)} and signal_id is null`;
  await sql`update kismet.signals set updated_at = now() where user_id = ${userId} and id = ${signalId}`;
}

export async function setSignalStatus(id: string, status: SignalStatus): Promise<void> {
  const sql = await db();
  await sql`update kismet.signals set status = ${status}, updated_at = now() where user_id = ${scopeUser()} and id = ${id}`;
}

export async function listSignals(): Promise<Signal[]> {
  const sql = await db();
  const userId = scopeUser();
  const signals = await sql`select * from kismet.signals where user_id = ${userId} order by updated_at desc limit 200`;
  const evidence = await sql`
    select * from kismet.evidence where user_id = ${userId} and signal_id is not null order by occurred_at desc limit 2000
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
      const distinctEvidence = new Set(items.map((item) => item.title)).size;
      return {
        id: String(row.id),
        title: String(row.title),
        problem: String(row.problem ?? ""),
        area: String(row.area ?? ""),
        status: row.status as SignalStatus,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        evidence: items,
        distinctEvidence,
        sources,
        ready: distinctEvidence >= READY_MIN_EVIDENCE && sources.length >= READY_MIN_SOURCES,
      };
    })
    .sort((a, b) => b.evidence.length - a.evidence.length);
}

export async function listExperiments(): Promise<Experiment[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.experiments where user_id = ${scopeUser()} order by created_at desc limit 100`;
  return rows.map(toExperiment);
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  const sql = await db();
  const rows = await sql`select * from kismet.experiments where user_id = ${scopeUser()} and id = ${id}`;
  return rows[0] ? toExperiment(rows[0]) : null;
}

export async function experimentOwnerBySession(sessionId: string): Promise<string | null> {
  const sql = await db();
  const rows = await sql<{ user_id: string }[]>`
    select user_id from kismet.experiments where coder_session_id = ${sessionId} limit 1
  `;
  return rows[0]?.user_id ?? null;
}

export async function createExperiment(input: {
  signalId: string;
  version: number;
  title: string;
  hypothesis: string;
  metric: string;
  metricSpec: MetricSpec;
  page: string;
  guardrail: string;
  control: string;
  treatment: string;
  flag: string;
}): Promise<string> {
  const sql = await db();
  const id = newId("exp");
  await sql`
    insert into kismet.experiments
      (id, user_id, signal_id, version, title, hypothesis, metric, metric_spec, page, guardrail, control, treatment, flag, status)
    values
      (${id}, ${scopeUser()}, ${input.signalId}, ${input.version}, ${input.title.slice(0, 200)}, ${input.hypothesis.slice(0, 1000)},
       ${input.metric.slice(0, 120)}, ${sql.json(input.metricSpec)}, ${input.page.slice(0, 200)}, ${input.guardrail.slice(0, 300)}, ${input.control.slice(0, 500)},
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
    draftPath: string | null;
    coderSessionId: string | null;
    agentFailed: boolean;
    builder: OutsideBuilder | null;
    buildRef: string | null;
    buildUrl: string | null;
    buildStartedAt: string | null;
    draft: string | null;
    original: string | null;
    cleanupStatus: CleanupStatus | null;
    cleanupPrUrl: string | null;
    cleanupPrNumber: number | null;
    cleanupDraft: string | null;
    cleanupNote: string | null;
    overlap: string | null;
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
  if (patch.draftPath !== undefined) columns.draft_path = patch.draftPath;
  if (patch.coderSessionId !== undefined) columns.coder_session_id = patch.coderSessionId;
  if (patch.agentFailed !== undefined) columns.agent_failed = patch.agentFailed;
  if (patch.builder !== undefined) columns.builder = patch.builder;
  if (patch.buildRef !== undefined) columns.build_ref = patch.buildRef;
  if (patch.buildUrl !== undefined) columns.build_url = patch.buildUrl;
  if (patch.buildStartedAt !== undefined) columns.build_started_at = patch.buildStartedAt;
  if (patch.draft !== undefined) columns.draft = patch.draft;
  if (patch.original !== undefined) columns.original = patch.original;
  if (patch.cleanupStatus !== undefined) columns.cleanup_status = patch.cleanupStatus;
  if (patch.cleanupPrUrl !== undefined) columns.cleanup_pr_url = patch.cleanupPrUrl;
  if (patch.cleanupPrNumber !== undefined) columns.cleanup_pr_number = patch.cleanupPrNumber;
  if (patch.cleanupDraft !== undefined) columns.cleanup_draft = patch.cleanupDraft;
  if (patch.cleanupNote !== undefined) columns.cleanup_note = patch.cleanupNote;
  if (patch.overlap !== undefined) columns.overlap = patch.overlap;
  if (patch.startedAt !== undefined) columns.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) columns.ended_at = patch.endedAt;
  if (Object.keys(columns).length === 0) return;
  await sql`update kismet.experiments set ${sql(columns)} where user_id = ${scopeUser()} and id = ${id}`;
}

export async function log(kind: string, message: string, ref?: string): Promise<void> {
  const sql = await db();
  if (kind === "error") {
    // The same failure repeats every run until someone fixes it; record it once a day.
    const [recent] = await sql`
      select 1 from kismet.activity
      where user_id = ${scopeUser()} and kind = 'error' and message = ${message.slice(0, 500)} and at > now() - interval '1 day' limit 1
    `;
    if (recent) return;
  }
  await sql`insert into kismet.activity (user_id, kind, message, ref) values (${scopeUser()}, ${kind}, ${message.slice(0, 500)}, ${ref ?? null})`;
}

export async function listActivity(limit = 40): Promise<Activity[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.activity where user_id = ${scopeUser()} order by id desc limit ${limit}`;
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
  const rows = await sql`select max(at) as at from kismet.activity where user_id = ${scopeUser()} and kind = 'tick'`;
  return isoOrNull(rows[0]?.at);
}

export async function evidenceCounts(sinceDays: number): Promise<{ total: number; real: number }> {
  const sql = await db();
  const rows = await sql`
    select count(*)::int as total, count(*) filter (where not synthetic)::int as real
    from kismet.evidence where user_id = ${scopeUser()} and occurred_at > now() - make_interval(days => ${sinceDays})
  `;
  return { total: Number(rows[0]?.total ?? 0), real: Number(rows[0]?.real ?? 0) };
}

/** Runs fn only if no other tick holds the lock, so overlapping cron and button runs never double-act. */
export async function withTickLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const sql = await db();
  return sql.reserve().then(async (conn) => {
    try {
      const userId = scopeUser();
      const [{ locked }] = await conn`select pg_try_advisory_lock(hashtext(${userId})) as locked`;
      if (!locked) return null;
      try {
        return await fn();
      } finally {
        await conn`select pg_advisory_unlock(hashtext(${userId}))`;
      }
    } finally {
      conn.release();
    }
  });
}

function toFlag(row: Row): FlagState {
  return {
    key: String(row.key),
    status: row.status as FlagState["status"],
    treatmentPct: Number(row.treatment_pct),
    layer: (row.layer as string | null) ?? null,
    slotStart: Number(row.slot_start ?? 0),
    slotEnd: Number(row.slot_end ?? 100),
  };
}

export async function listFlags(): Promise<FlagState[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.flags where user_id = ${scopeUser()} and status <> 'off'`;
  return rows.map(toFlag);
}

export async function setFlag(
  key: string,
  status: FlagState["status"],
  treatmentPct = 50,
  slice?: { layer: string | null; slotStart: number; slotEnd: number }
): Promise<void> {
  const sql = await db();
  const userId = scopeUser();
  if (slice) {
    await sql`
      insert into kismet.flags (user_id, key, status, treatment_pct, layer, slot_start, slot_end)
      values (${userId}, ${key}, ${status}, ${treatmentPct}, ${slice.layer}, ${slice.slotStart}, ${slice.slotEnd})
      on conflict (user_id, key) do update set status = excluded.status, treatment_pct = excluded.treatment_pct,
        layer = excluded.layer, slot_start = excluded.slot_start, slot_end = excluded.slot_end, updated_at = now()
    `;
    return;
  }
  await sql`
    insert into kismet.flags (user_id, key, status, treatment_pct) values (${userId}, ${key}, ${status}, ${treatmentPct})
    on conflict (user_id, key) do update set status = excluded.status, treatment_pct = excluded.treatment_pct, updated_at = now()
  `;
}

export interface NewEvent {
  visitor: string;
  name: "view" | "click";
  page: string;
  element: string;
  arms: Record<string, Arm>;
  synthetic: boolean;
  at?: string;
}

export async function addEvents(events: NewEvent[]): Promise<void> {
  if (events.length === 0) return;
  const sql = await db();
  const userId = scopeUser();
  const rows = events.map((e) => ({
    user_id: userId,
    visitor: e.visitor.slice(0, 64),
    name: e.name,
    page: e.page.slice(0, 200),
    element: e.element.slice(0, 80),
    arms: sql.json(e.arms),
    synthetic: e.synthetic,
    at: e.at ?? new Date().toISOString(),
  }));
  await sql`insert into kismet.events ${sql(rows)}`;
}

/** Number of events received for this account during the trailing window. */
export async function eventsSince(hours: number): Promise<number> {
  const sql = await db();
  const safeHours = Math.max(1, Math.min(24 * 30, Math.floor(hours)));
  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count from kismet.events
    where user_id = ${scopeUser()} and at >= now() - (${safeHours} * interval '1 hour')
  `;
  return Number(rows[0]?.count ?? 0);
}

export interface ArmCount {
  arm: Arm;
  visitors: number;
  conversions: number;
  syntheticVisitors: number;
}

/** Visitors and converted visitors per arm since the experiment started, counted from tracked events. */
export async function countArms(flag: string, since: string, spec: MetricSpec): Promise<ArmCount[]> {
  const sql = await db();
  const converts =
    spec.kind === "click"
      ? sql`e.name = 'click' and e.element ilike ${"%" + spec.text + "%"}`
      : sql`e.name = 'view' and e.page like ${spec.path.replace(/[%_]/g, "") + "%"}`;
  const rows = await sql`
    with exposed as (
      select visitor, min(arms ->> ${flag}) as arm, bool_or(synthetic) as synthetic
      from kismet.events
      where user_id = ${scopeUser()} and at >= ${since} and arms ? ${flag}
      group by visitor
    ),
    converted as (
      select distinct e.visitor from kismet.events e
      where e.user_id = ${scopeUser()} and e.at >= ${since} and e.arms ? ${flag} and ${converts}
    )
    select x.arm,
           count(*)::int as visitors,
           count(c.visitor)::int as conversions,
           count(*) filter (where x.synthetic)::int as synthetic_visitors
    from exposed x left join converted c on c.visitor = x.visitor
    group by x.arm
  `;
  return (["control", "treatment"] as Arm[]).map((arm) => {
    const row = rows.find((r) => r.arm === arm);
    return {
      arm,
      visitors: Number(row?.visitors ?? 0),
      conversions: Number(row?.conversions ?? 0),
      syntheticVisitors: Number(row?.synthetic_visitors ?? 0),
    };
  });
}

export interface CrossCount {
  arm: Arm;
  otherArm: Arm;
  visitors: number;
  conversions: number;
}

/** One experiment's visitors and conversions, split by which version of another experiment they saw. */
export async function countArmsAcross(flag: string, other: string, since: string, spec: MetricSpec): Promise<CrossCount[]> {
  const sql = await db();
  const converts =
    spec.kind === "click"
      ? sql`e.name = 'click' and e.element ilike ${"%" + spec.text + "%"}`
      : sql`e.name = 'view' and e.page like ${spec.path.replace(/[%_]/g, "") + "%"}`;
  const rows = await sql`
    with exposed as (
      select visitor, min(arms ->> ${flag}) as arm, min(arms ->> ${other}) as other_arm
      from kismet.events
      where user_id = ${scopeUser()} and at >= ${since} and arms ? ${flag} and arms ? ${other}
      group by visitor
    ),
    converted as (
      select distinct e.visitor from kismet.events e
      where e.user_id = ${scopeUser()} and e.at >= ${since} and e.arms ? ${flag} and ${converts}
    )
    select x.arm, x.other_arm, count(*)::int as visitors, count(c.visitor)::int as conversions
    from exposed x left join converted c on c.visitor = x.visitor
    group by x.arm, x.other_arm
  `;
  return rows.map((row) => ({
    arm: row.arm as Arm,
    otherArm: row.other_arm as Arm,
    visitors: Number(row.visitors),
    conversions: Number(row.conversions),
  }));
}

export interface ElementStat {
  page: string;
  element: string;
  pageVisitors: number;
  clickers: number;
  synthetic: boolean;
}

/** Click-through of every labelled element on pages with enough traffic, for spotting what people ignore. */
export async function elementStats(sinceDays: number, minVisitors: number): Promise<ElementStat[]> {
  const sql = await db();
  const rows = await sql`
    with views as (
      select page, count(distinct visitor)::int as visitors, bool_and(synthetic) as synthetic
      from kismet.events where user_id = ${scopeUser()} and name = 'view' and at > now() - make_interval(days => ${sinceDays})
      group by page having count(distinct visitor) >= ${minVisitors}
    ),
    clicks as (
      select page, element, count(distinct visitor)::int as clickers
      from kismet.events where user_id = ${scopeUser()} and name = 'click' and at > now() - make_interval(days => ${sinceDays})
      group by page, element
    )
    select v.page, c.element, v.visitors, c.clickers, v.synthetic
    from views v join clicks c on c.page = v.page
  `;
  return rows.map((row) => ({
    page: String(row.page),
    element: String(row.element),
    pageVisitors: Number(row.visitors),
    clickers: Number(row.clickers),
    synthetic: Boolean(row.synthetic),
  }));
}

export async function knownEvidenceUrls(urls: string[]): Promise<Set<string>> {
  const unique = [...new Set(urls.filter((url) => url.length > 0))];
  if (unique.length === 0) return new Set();
  const sql = await db();
  const rows = await sql<{ url: string }[]>`
    select url from kismet.evidence where user_id = ${scopeUser()} and url in ${sql(unique)}
  `;
  return new Set(rows.map((row) => row.url).filter((url): url is string => typeof url === "string"));
}

/** Updates the latest evidence with this title to the newest numbers. False when there is none yet. */
export async function refreshEvidenceTitled(title: string, body: string): Promise<boolean> {
  const sql = await db();
  const userId = scopeUser();
  const rows = await sql`
    update kismet.evidence set body = ${body.slice(0, 4000)}, occurred_at = now()
    where id = (
      select id from kismet.evidence where user_id = ${userId} and title = ${title} order by occurred_at desc limit 1
    )
    returning id
  `;
  return rows.length > 0;
}

/** The file before and after an experiment's change, as stored when it was built. */
export async function experimentDraft(id: string): Promise<{ path: string; content: string; original: string | null } | null> {
  const sql = await db();
  const [row] = await sql`select draft_path, draft, original from kismet.experiments where user_id = ${scopeUser()} and id = ${id}`;
  if (!row?.draft_path || !row?.draft) return null;
  return { path: String(row.draft_path), content: String(row.draft), original: (row.original as string | null) ?? null };
}
