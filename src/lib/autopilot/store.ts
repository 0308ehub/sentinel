import "server-only";

import { db, newId } from "@/lib/autopilot/db";
import { autopilotUser, siteAutopilotUser } from "@/lib/autopilot/scope";
import { parseMetricSpec, type Arm, type FlagState, type MetricSpec } from "@/lib/autopilot/assign";
import { chosenBuilder, isOutsideBuilder, type Builder, type OutsideBuilder } from "@/lib/autopilot/builders";
import { ANALYTICS_FRESH_DAYS, ELEMENT_GONE_DAYS, otherFreshDays } from "@/lib/autopilot/freshness";
import type { ResultEstimate } from "@/lib/autopilot/power";
import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import { formatJourneys, type JourneyEvent } from "@/lib/autopilot/journeys";
import { signalIsReady } from "@/lib/autopilot/readiness";
import {
  READY_MIN_EVIDENCE,
  READY_MIN_SOURCES,
  type Activity,
  type CleanupStatus,
  type Evidence,
  type EvidenceSource,
  type Experiment,
  type ExperimentStatus,
  type Goal,
  type Learning,
  type LearningOutcome,
  type Readout,
  type Signal,
  type SignalStatus,
  type SuggestionRating,
  type SuggestionRatingValue,
  type SuggestionTargetKind,
} from "@/lib/autopilot/types";

type Row = Record<string, unknown>;

function scopeUser(): string {
  return autopilotUser();
}

/** Rows written before accounts were split belong to the deployment owner. */
export async function claimLegacyRows(userId: string): Promise<void> {
  const owner = await siteAutopilotUser();
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

function parseRollout(value: unknown): { at: string; pass: number }[] | null {
  if (!Array.isArray(value)) return null;
  const phases = value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const at = String((row as { at?: unknown }).at ?? "");
    const pass = Number((row as { pass?: unknown }).pass);
    if (!at || Number.isNaN(new Date(at).getTime()) || !Number.isInteger(pass)) return [];
    return [{ at, pass }];
  });
  return phases.length ? phases : null;
}

function toExperiment(row: Row): Experiment {
  return {
    id: String(row.id),
    signalId: String(row.signal_id),
    version: Number(row.version),
    kind: row.kind === "change" || row.kind === "fix" ? row.kind : "test",
    title: String(row.title),
    hypothesis: String(row.hypothesis ?? ""),
    metric: String(row.metric ?? ""),
    metricSpec: parseMetricSpec(row.metric_spec),
    guardrailSpec: parseMetricSpec(row.guardrail_spec),
    page: String(row.page ?? ""),
    overlap: (row.overlap as string | null) ?? null,
    guardrail: String(row.guardrail ?? ""),
    control: String(row.control ?? ""),
    treatment: String(row.treatment ?? ""),
    changeSummary: (row.change_summary as ChangeSummary | null) ?? null,
    flag: String(row.flag),
    mode: row.mode === "stochastic" ? "stochastic" : "deterministic",
    rollout: parseRollout(row.rollout),
    status: row.status as ExperimentStatus,
    rejectedBy: row.rejected_by === "person" || row.rejected_by === "kismet" ? row.rejected_by : null,
    branch: (row.branch as string | null) ?? null,
    prUrl: (row.pr_url as string | null) ?? null,
    prNumber: row.pr_number == null ? null : Number(row.pr_number),
    note: (row.note as string | null) ?? null,
    adjustments: (row.adjustments as string | null) ?? null,
    readout: (row.readout as Readout | null) ?? null,
    rationale: (row.rationale as Experiment["rationale"]) ?? null,
    directional: (row.directional as Experiment["directional"]) ?? null,
    estimate: (row.estimate as ResultEstimate | null) ?? null,
    draftPath: (row.draft_path as string | null) ?? null,
    coderSessionId: (row.coder_session_id as string | null) ?? null,
    agentFailed: Boolean(row.agent_failed),
    buildWith: chosenBuilder(row.build_with),
    builder: isOutsideBuilder(row.builder) ? row.builder : null,
    buildRef: (row.build_ref as string | null) ?? null,
    buildUrl: (row.build_url as string | null) ?? null,
    buildStartedAt: isoOrNull(row.build_started_at),
    buildStage: (row.build_stage as Experiment["buildStage"]) ?? null,
    buildStageAt: isoOrNull(row.build_stage_at),
    buildSteps: row.build_steps == null ? null : Number(row.build_steps),
    buildAttempts: Number(row.build_attempts ?? 0),
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
    verifiedAt: isoOrNull(row.verified_at),
    verdict: row.verdict === "fixed" || row.verdict === "not_fixed" ? row.verdict : null,
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
  const otherDays = otherFreshDays();
  const rows = await sql`
    select * from kismet.evidence
    where user_id = ${scopeUser()} and signal_id is null
      and (source = 'interview' or occurred_at >= now() - make_interval(days => case when source = 'analytics' then ${ANALYTICS_FRESH_DAYS}::int else ${otherDays}::int end))
    order by occurred_at asc limit ${limit}
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

export async function setSignalAdjustments(id: string, adjustments: string | null): Promise<void> {
  const sql = await db();
  await sql`
    update kismet.signals set adjustments = ${adjustments}, updated_at = now()
    where user_id = ${scopeUser()} and id = ${id}
  `;
}

export async function setSignalTriage(id: string, kind: "bug" | "idea", reason: string): Promise<void> {
  const sql = await db();
  await sql`
    update kismet.signals set kind = ${kind}, kind_reason = ${reason.slice(0, 500)}, updated_at = now()
    where user_id = ${scopeUser()} and id = ${id} and kind is null
  `;
}

export async function listSignals(): Promise<Signal[]> {
  const sql = await db();
  const userId = scopeUser();
  const signals = await sql`select *, case when snoozed_until > now() then snoozed_until end as active_snoozed_until
    from kismet.signals where user_id = ${userId} order by updated_at desc limit 200`;
  const otherDays = otherFreshDays();
  const evidence = await sql`
    select *, source = 'interview' or occurred_at >= now() - make_interval(days => case when source = 'analytics' then ${ANALYTICS_FRESH_DAYS}::int else ${otherDays}::int end) as fresh
    from kismet.evidence where user_id = ${userId} and signal_id is not null order by occurred_at desc limit 5000
  `;
  const bySignal = new Map<string, Evidence[]>();
  const staleBySignal = new Map<string, number>();
  for (const row of evidence) {
    const item = toEvidence(row);
    if (!row.fresh) {
      staleBySignal.set(item.signalId!, (staleBySignal.get(item.signalId!) ?? 0) + 1);
      continue;
    }
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
        kind: row.kind === "bug" || row.kind === "idea" ? row.kind : null,
        kindReason: (row.kind_reason as string | null) ?? null,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        evidence: items,
        distinctEvidence,
        staleEvidence: staleBySignal.get(String(row.id)) ?? 0,
        sources,
        ready: signalIsReady({
          kind: row.kind === "bug" || row.kind === "idea" ? row.kind : null,
          distinctEvidence,
          distinctSources: sources.length,
          evidence: items,
          minEvidence: READY_MIN_EVIDENCE,
          minSources: READY_MIN_SOURCES,
        }),
        snoozedUntil: isoOrNull(row.active_snoozed_until),
        adjustments: (row.adjustments as string | null) ?? null,
      };
    })
    .sort((a, b) => b.evidence.length - a.evidence.length);
}

function toRating(row: Row): SuggestionRating {
  return {
    id: String(row.id),
    targetKind: row.target_kind as SuggestionTargetKind,
    targetId: String(row.target_id),
    rating: row.rating as SuggestionRatingValue,
    reason: (row.reason as string | null) ?? null,
    title: String(row.title),
    createdAt: iso(row.created_at),
  };
}

export async function rateSuggestion(input: {
  targetKind: SuggestionTargetKind;
  targetId: string;
  rating: SuggestionRatingValue;
  reason?: string | null;
  title: string;
}): Promise<SuggestionRating> {
  const sql = await db();
  const rows = await sql`
    insert into kismet.suggestion_ratings (id, user_id, target_kind, target_id, rating, reason, title)
    values (${newId("rating")}, ${scopeUser()}, ${input.targetKind}, ${input.targetId}, ${input.rating}, ${input.reason?.slice(0, 200) || null}, ${input.title.slice(0, 200)})
    on conflict (user_id, target_kind, target_id) do update
      set rating = excluded.rating, reason = excluded.reason, title = excluded.title, created_at = now()
    returning *
  `;
  return toRating(rows[0]);
}

export async function listRatings(limit = 30): Promise<SuggestionRating[]> {
  const sql = await db();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await sql`
    select * from kismet.suggestion_ratings
    where user_id = ${scopeUser()}
    order by created_at desc limit ${safeLimit}::int
  `;
  return rows.map(toRating);
}

export async function ratingFor(targetKind: SuggestionTargetKind, targetId: string): Promise<SuggestionRating | null> {
  const sql = await db();
  const rows = await sql`
    select * from kismet.suggestion_ratings
    where user_id = ${scopeUser()} and target_kind = ${targetKind} and target_id = ${targetId}
    limit 1
  `;
  return rows[0] ? toRating(rows[0]) : null;
}

export async function listExperiments(): Promise<Experiment[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.experiments where user_id = ${scopeUser()} order by created_at desc limit 100`;
  return rows.map(toExperiment);
}

function toLearning(row: Row): Learning {
  return {
    id: String(row.id),
    experimentId: String(row.experiment_id),
    signalId: (row.signal_id as string | null) ?? null,
    kind: row.kind as Learning["kind"],
    outcome: row.outcome as LearningOutcome,
    title: String(row.title ?? ""),
    page: String(row.page ?? ""),
    metric: String(row.metric ?? ""),
    change: String(row.change ?? ""),
    lift: row.lift == null ? null : Number(row.lift),
    pValue: row.p_value == null ? null : Number(row.p_value),
    visitors: row.visitors == null ? null : Number(row.visitors),
    learning: String(row.learning),
    createdAt: iso(row.created_at),
  };
}

export async function listLearnings(limit = 100): Promise<Learning[]> {
  const sql = await db();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const rows = await sql`
    select * from kismet.autopilot_learnings
    where user_id = ${scopeUser()}
    order by created_at desc limit ${safeLimit}::int
  `;
  return rows.map(toLearning);
}

export async function learningFor(experimentId: string): Promise<Learning | null> {
  const sql = await db();
  const rows = await sql`
    select * from kismet.autopilot_learnings
    where user_id = ${scopeUser()} and experiment_id = ${experimentId}
    limit 1
  `;
  return rows[0] ? toLearning(rows[0]) : null;
}

export async function insertLearning(input: Omit<Learning, "id" | "createdAt">): Promise<void> {
  const sql = await db();
  await sql`
    insert into kismet.autopilot_learnings
      (id, user_id, experiment_id, signal_id, kind, outcome, title, page, metric, change, lift, p_value, visitors, learning)
    values
      (${newId("learn")}, ${scopeUser()}, ${input.experimentId}, ${input.signalId}, ${input.kind}, ${input.outcome},
       ${input.title.slice(0, 200)}, ${input.page.slice(0, 200)}, ${input.metric.slice(0, 120)}, ${input.change.slice(0, 500)},
       ${input.lift}::float8, ${input.pValue}::float8, ${input.visitors}::int, ${input.learning.slice(0, 1200)})
    on conflict (user_id, experiment_id) do nothing
  `;
}

export async function experimentsNeedingLearnings(): Promise<Experiment[]> {
  const sql = await db();
  const rows = await sql`
    select e.* from kismet.experiments e
    where e.user_id = ${scopeUser()}
      and e.ended_at is not null
      and e.status in ('rolled_out', 'stopped', 'rejected')
      and coalesce(e.kind, 'experiment') <> 'fix'
      and (e.status <> 'rejected' or e.rejected_by = 'person'
        or (e.rejected_by is null and coalesce(e.note, '') <> 'Its evidence went stale before it was built.'))
      -- Results measured mostly on simulated traffic teach nothing about real people.
      and coalesce((e.readout ->> 'syntheticShare')::float8, 0) < 0.5::float8
      and not exists (
        select 1 from kismet.autopilot_learnings l
        where l.user_id = ${scopeUser()} and l.experiment_id = e.id
      )
    order by e.ended_at desc limit 5
  `;
  return rows.map(toExperiment);
}

/** Retires unsupported problems and revives stale ones when current evidence returns. */
export async function retireStaleSignals(): Promise<string | null> {
  const sql = await db();
  const userId = scopeUser();
  const otherDays = otherFreshDays();
  const stale = await sql`
    update kismet.signals s set status = 'stale', updated_at = now()
    where s.user_id = ${userId} and s.status = 'open' and not exists (
      select 1 from kismet.evidence e
      where e.user_id = ${userId} and e.signal_id = s.id
        and (e.source = 'interview' or e.occurred_at >= now() - make_interval(days => case when e.source = 'analytics' then ${ANALYTICS_FRESH_DAYS}::int else ${otherDays}::int end))
    )
    returning s.id, s.title
  `;
  const revived = await sql`
    update kismet.signals s set status = 'open', updated_at = now()
    where s.user_id = ${userId} and s.status = 'stale' and exists (
      select 1 from kismet.evidence e
      where e.user_id = ${userId} and e.signal_id = s.id
        and (e.source = 'interview' or e.occurred_at >= now() - make_interval(days => case when e.source = 'analytics' then ${ANALYTICS_FRESH_DAYS}::int else ${otherDays}::int end))
    )
    returning s.id
  `;

  if (stale.length > 0) {
    const ids = stale.map((row) => String(row.id));
    await sql`
      update kismet.experiments set status = 'rejected', rejected_by = 'kismet', note = 'Its evidence went stale before it was built.', ended_at = now()
      where user_id = ${userId} and signal_id in ${sql(ids)} and status = 'building'
        and pr_number is null and coder_session_id is null and build_ref is null
    `;
    for (const row of stale) {
      await log("freshness", `“${String(row.title)}” went stale: its evidence is no longer current.`, String(row.id));
    }
  }

  if (stale.length === 0 && revived.length === 0) return null;
  const parts = [];
  if (stale.length > 0) parts.push(`${stale.length} problem${stale.length === 1 ? "" : "s"} went stale`);
  if (revived.length > 0) parts.push(`${revived.length} problem${revived.length === 1 ? "" : "s"} became current again`);
  return `${parts.join("; ")}.`;
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  const sql = await db();
  const rows = await sql`select * from kismet.experiments where user_id = ${scopeUser()} and id = ${id}`;
  return rows[0] ? toExperiment(rows[0]) : null;
}

export async function setExperimentChangeSummary(id: string, summary: ChangeSummary): Promise<void> {
  const sql = await db();
  await sql`
    update kismet.experiments set change_summary = ${sql.json({ ...summary })}
    where user_id = ${scopeUser()} and id = ${id}
  `;
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
  metricSpec?: MetricSpec | null;
  page: string;
  guardrail: string;
  guardrailSpec?: MetricSpec | null;
  control: string;
  treatment: string;
  flag: string;
  estimate?: ResultEstimate | null;
  kind?: Experiment["kind"];
  mode?: "deterministic" | "stochastic";
  rationale?: Experiment["rationale"];
  buildWith?: Builder | null;
  adjustments?: string | null;
}): Promise<string> {
  const sql = await db();
  const id = newId("exp");
  await sql`
    insert into kismet.experiments
      (id, user_id, signal_id, version, kind, title, hypothesis, metric, metric_spec, guardrail_spec, page, guardrail, control, treatment, flag, estimate, rationale, mode, build_with, adjustments, status)
    values
      (${id}, ${scopeUser()}, ${input.signalId}, ${input.version}, ${input.kind ?? "test"}, ${input.title.slice(0, 200)}, ${input.hypothesis.slice(0, 1000)},
       ${input.metric.slice(0, 120)}, ${input.metricSpec ? sql.json(input.metricSpec) : null}, ${input.guardrailSpec ? sql.json(input.guardrailSpec) : null}, ${input.page.slice(0, 200)}, ${input.guardrail.slice(0, 300)}, ${input.control.slice(0, 500)},
       ${input.treatment.slice(0, 500)}, ${input.flag}, ${input.estimate ? sql.json(input.estimate as never) : null}, ${input.rationale ? sql.json(input.rationale as never) : null},
       ${input.mode === "stochastic" ? "stochastic" : "deterministic"}, ${input.buildWith ?? null}, ${input.adjustments ?? null}, 'building')
  `;
  return id;
}

export async function updateExperiment(
  id: string,
  patch: Partial<{
    status: ExperimentStatus;
    rejectedBy: "person" | "kismet" | null;
    prUrl: string | null;
    prNumber: number | null;
    branch: string | null;
    note: string | null;
    adjustments: string | null;
    readout: Readout | null;
    directional: Experiment["directional"];
    draftPath: string | null;
    coderSessionId: string | null;
    agentFailed: boolean;
    builder: OutsideBuilder | null;
    buildRef: string | null;
    buildUrl: string | null;
    buildStartedAt: string | null;
    buildStage: Experiment["buildStage"];
    buildStageAt: string | null;
    buildSteps: number | null;
    buildAttempts: number;
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
    verifiedAt: string | null;
    verdict: "fixed" | "not_fixed" | null;
    rollout: { at: string; pass: number }[] | null;
  }>
): Promise<void> {
  const sql = await db();
  const columns: Row = {};
  if (patch.status !== undefined) columns.status = patch.status;
  if (patch.rejectedBy !== undefined) columns.rejected_by = patch.rejectedBy;
  if (patch.prUrl !== undefined) columns.pr_url = patch.prUrl;
  if (patch.prNumber !== undefined) columns.pr_number = patch.prNumber;
  if (patch.branch !== undefined) columns.branch = patch.branch;
  if (patch.note !== undefined) columns.note = patch.note;
  if (patch.adjustments !== undefined) columns.adjustments = patch.adjustments;
  if (patch.readout !== undefined) columns.readout = patch.readout === null ? null : sql.json(patch.readout as never);
  if (patch.directional !== undefined) columns.directional = patch.directional === null ? null : sql.json(patch.directional as never);
  if (patch.draftPath !== undefined) columns.draft_path = patch.draftPath;
  if (patch.coderSessionId !== undefined) columns.coder_session_id = patch.coderSessionId;
  if (patch.agentFailed !== undefined) columns.agent_failed = patch.agentFailed;
  if (patch.builder !== undefined) columns.builder = patch.builder;
  if (patch.buildRef !== undefined) columns.build_ref = patch.buildRef;
  if (patch.buildUrl !== undefined) columns.build_url = patch.buildUrl;
  if (patch.buildStartedAt !== undefined) columns.build_started_at = patch.buildStartedAt;
  if (patch.buildStage !== undefined) columns.build_stage = patch.buildStage;
  if (patch.buildStageAt !== undefined) columns.build_stage_at = patch.buildStageAt;
  if (patch.buildSteps !== undefined) columns.build_steps = patch.buildSteps;
  if (patch.buildAttempts !== undefined) columns.build_attempts = patch.buildAttempts;
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
  if (patch.verifiedAt !== undefined) columns.verified_at = patch.verifiedAt;
  if (patch.verdict !== undefined) columns.verdict = patch.verdict;
  if (patch.rollout !== undefined) columns.rollout = patch.rollout === null ? null : sql.json(patch.rollout as never);
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

export async function listActivity(limit = 100): Promise<Activity[]> {
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

/** True when evidence arrived after the last run and has not been sorted into a problem yet. */
export async function hasUnsortedEvidenceSince(at: string | null): Promise<boolean> {
  const sql = await db();
  const rows = at
    ? await sql`select 1 from kismet.evidence where user_id = ${scopeUser()} and signal_id is null and created_at > ${at} limit 1`
    : await sql`select 1 from kismet.evidence where user_id = ${scopeUser()} and signal_id is null limit 1`;
  return rows.length > 0;
}

export async function lastRunAt(): Promise<string | null> {
  const sql = await db();
  const rows = await sql`select max(at) as at from kismet.activity where user_id = ${scopeUser()} and kind = 'tick'`;
  return isoOrNull(rows[0]?.at);
}

export async function recentTickActivity(limit = 10): Promise<Activity[]> {
  const sql = await db();
  const rows = await sql`
    select * from kismet.activity where user_id = ${scopeUser()} and kind = 'tick'
    order by id desc limit ${limit}
  `;
  return rows.map((row) => ({ id: Number(row.id), at: iso(row.at), kind: "tick", message: String(row.message), ref: null }));
}

export async function latestErrorMessage(): Promise<string | null> {
  const sql = await db();
  const rows = await sql`
    select message from kismet.activity where user_id = ${scopeUser()} and kind = 'error'
    order by id desc limit 1
  `;
  return rows[0] ? String(rows[0].message) : null;
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
/** Longer than the tick route's 300s limit, so a run that was killed frees its account soon after. */
const TICK_LEASE_SECONDS = 360;

/**
 * Runs fn only if no other run holds this account's lease. Each statement stands alone, so this
 * works through a transaction pooler, unlike a session advisory lock.
 */
export async function withTickLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const sql = await db();
  const userId = scopeUser();
  const holder = newId("tick");
  const claimed = await sql`
    insert into kismet.autopilot_tick_lock (user_id, holder, expires_at)
    values (${userId}, ${holder}, now() + make_interval(secs => ${TICK_LEASE_SECONDS}))
    on conflict (user_id) do update
      set holder = excluded.holder, expires_at = excluded.expires_at
      where kismet.autopilot_tick_lock.expires_at < now()
    returning holder
  `;
  if (!claimed.length) return null;
  try {
    return await fn();
  } finally {
    await sql`delete from kismet.autopilot_tick_lock where user_id = ${userId} and holder = ${holder}`;
  }
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

type Db = Awaited<ReturnType<typeof db>>;

/**
 * The events that count as a conversion for a metric. Columns are unqualified so the condition fits
 * any query that reads a single events table.
 */
function converts(sql: Db, spec: MetricSpec) {
  if (spec.kind === "click") return sql`name = 'click' and element ilike ${"%" + spec.text + "%"}`;
  if (spec.kind === "visit") return sql`name = 'view' and page like ${spec.path.replace(/[%_]/g, "") + "%"}`;
  return sql`name = 'track' and element = ${spec.name}`;
}

/**
 * view and click come from the browser. track is an event the site reports itself (kismet.track).
 * exposure marks that the server SDK put a visitor in an experiment; element holds the flag.
 */
export type EventName = "view" | "click" | "track" | "exposure";

export interface NewEvent {
  visitor: string;
  name: EventName;
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
  const rows = await sql`
    with exposed as (
      select visitor, min(arms ->> ${flag}) as arm, bool_or(synthetic) as synthetic
      from kismet.events
      where user_id = ${scopeUser()} and at >= ${since} and arms ? ${flag}
      group by visitor
    ),
    converted as (
      select distinct e.visitor from kismet.events e
      where e.user_id = ${scopeUser()} and e.at >= ${since} and e.arms ? ${flag} and ${converts(sql, spec)}
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

export interface MetricBaseline {
  visitors: number;
  conversions: number;
  weeklyVisitors: number;
}

/** Account-wide metric counts for an explicit half-open time window. */
export async function metricWindow(spec: MetricSpec, from: string, to: string): Promise<MetricBaseline> {
  const sql = await db();
  const userId = scopeUser();
  const [row] = await sql`
    with mode as (
      select not exists (
        select 1 from kismet.events where user_id = ${userId} and at >= ${from} and at < ${to} and synthetic = false
      ) as include_synthetic
    ), active as (
      select distinct visitor from kismet.events, mode
      where user_id = ${userId} and at >= ${from} and at < ${to} and (not synthetic or mode.include_synthetic)
    ), converted as (
      select distinct e.visitor from kismet.events e, mode
      where e.user_id = ${userId} and e.at >= ${from} and e.at < ${to}
        and (not e.synthetic or mode.include_synthetic) and ${converts(sql, spec)}
    )
    select count(*)::int as visitors, count(c.visitor)::int as conversions
    from active a left join converted c on c.visitor = a.visitor
  `;
  const visitors = Number(row?.visitors ?? 0);
  const days = Math.max(1, (Date.parse(to) - Date.parse(from)) / 86_400_000);
  return { visitors, conversions: Number(row?.conversions ?? 0), weeklyVisitors: visitors * 7 / days };
}

/** Account-wide baseline using the same visitor/conversion semantics as experiment measurement. */
export async function metricBaseline(spec: MetricSpec, days = 14): Promise<MetricBaseline> {
  const sql = await db();
  const userId = scopeUser();
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const [row] = await sql`
    with mode as (
      select not exists (
        select 1 from kismet.events where user_id = ${userId}
          and at >= now() - make_interval(days => ${safeDays}::int) and synthetic = false
      ) as include_synthetic
    ), active as (
      select distinct visitor from kismet.events, mode
      where user_id = ${userId} and at >= now() - make_interval(days => ${safeDays}::int)
        and (not synthetic or mode.include_synthetic)
    ), converted as (
      select distinct e.visitor from kismet.events e, mode
      where e.user_id = ${userId} and e.at >= now() - make_interval(days => ${safeDays}::int)
        and (not e.synthetic or mode.include_synthetic) and ${converts(sql, spec)}
    )
    select count(*)::int as visitors, count(c.visitor)::int as conversions
    from active a left join converted c on c.visitor = a.visitor
  `;
  const visitors = Number(row?.visitors ?? 0);
  return { visitors, conversions: Number(row?.conversions ?? 0), weeklyVisitors: visitors * 7 / safeDays };
}

/** Recent ordered journeys, preferring real traffic and anonymizing visitor identifiers. */
export async function recentJourneys(days = 14, limit = 12): Promise<string[]> {
  const sql = await db();
  const userId = scopeUser();
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const rows = await sql`
    with mode as (
      select not exists (
        select 1 from kismet.events where user_id = ${userId}
          and at >= now() - make_interval(days => ${safeDays}::int) and synthetic = false
      ) as include_synthetic
    ), eligible as (
      select e.* from kismet.events e, mode where e.user_id = ${userId}
        and e.at >= now() - make_interval(days => ${safeDays}::int)
        and (not e.synthetic or mode.include_synthetic) and e.name <> 'exposure'
    ), chosen as (
      select visitor, max(at) as latest, count(distinct at::date)::int as visits
      from eligible group by visitor order by latest desc limit ${safeLimit}::int
    ), firsts as (
      select visitor, min(at) as first_at
      from kismet.events where user_id = ${userId} group by visitor
    )
    select e.visitor, e.name, e.page, e.element, e.at, f.first_at, c.visits
    from eligible e join chosen c on c.visitor = e.visitor join firsts f on f.visitor = e.visitor
    order by c.latest desc, e.at asc
  `;
  const windowStart = new Date(Date.now() - safeDays * 86_400_000).toISOString();
  return formatJourneys(rows.map((row) => ({
    visitor: String(row.visitor), name: row.name as JourneyEvent["name"], page: String(row.page ?? ""),
    element: String(row.element ?? ""), at: iso(row.at), firstAt: iso(row.first_at), windowStart, visits: Number(row.visits),
  })));
}

export async function snoozeSignal(id: string): Promise<void> {
  const sql = await db();
  await sql`update kismet.signals set snoozed_until = now() + interval '7 days', updated_at = now()
    where user_id = ${scopeUser()} and id = ${id}`;
}

function toGoal(row: Row, baseline: MetricBaseline): Goal {
  return {
    id: String(row.id), name: String(row.name), spec: parseMetricSpec(row.spec)!,
    source: row.source as Goal["source"], createdAt: iso(row.created_at),
    baselineRate: baseline.visitors ? baseline.conversions / baseline.visitors : 0,
    weeklyVisitors: baseline.weeklyVisitors,
  };
}

export async function listGoals(): Promise<Goal[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.autopilot_goals where user_id = ${scopeUser()} and archived = false order by created_at asc`;
  return Promise.all(rows.map(async (row) => toGoal(row, await metricBaseline(parseMetricSpec(row.spec)!))));
}

export async function addGoal(input: { name: string; spec: MetricSpec; source: Goal["source"] }): Promise<string | null> {
  const sql = await db();
  const userId = scopeUser();
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from kismet.autopilot_goals
    where user_id = ${userId} and archived = false`;
  if (Number(count) >= 5) return null;
  const id = newId("goal");
  await sql`insert into kismet.autopilot_goals (id, user_id, name, spec, source)
    values (${id}, ${userId}, ${input.name.slice(0, 60)}, ${sql.json(input.spec)}, ${input.source})`;
  return id;
}

export async function archiveGoal(id: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`update kismet.autopilot_goals set archived = true where user_id = ${scopeUser()} and id = ${id} returning id`;
  return rows.length > 0;
}

export async function interviewContext(): Promise<Evidence[]> {
  const sql = await db();
  const rows = await sql`select * from kismet.evidence where user_id = ${scopeUser()} and source = 'interview'
    order by occurred_at desc limit 12`;
  return rows.map(toEvidence);
}

export interface PopularEvent { label: string; visitors: number }
export async function popularUsage(): Promise<{ visitors: number; pages: PopularEvent[]; clicks: PopularEvent[]; events: PopularEvent[] }> {
  const sql = await db();
  const userId = scopeUser();
  const [total, pages, clicks, events] = await Promise.all([
    sql`select count(distinct visitor)::int as visitors from kismet.events where user_id = ${userId} and at >= now() - interval '14 days'`,
    sql`select page as label, count(distinct visitor)::int as visitors from kismet.events where user_id = ${userId}
      and at >= now() - interval '14 days' and name = 'view' group by page order by visitors desc limit 30`,
    sql`select element as label, count(distinct visitor)::int as visitors from kismet.events where user_id = ${userId}
      and at >= now() - interval '14 days' and name = 'click' and element <> '' group by element order by visitors desc limit 40`,
    sql`select element as label, count(distinct visitor)::int as visitors from kismet.events where user_id = ${userId}
      and at >= now() - interval '14 days' and name = 'track' group by element order by visitors desc limit 30`,
  ]);
  const popular = (rows: typeof pages) => rows.map((r) => ({ label: String(r.label), visitors: Number(r.visitors) }));
  return { visitors: Number(total[0]?.visitors ?? 0), pages: popular(pages), clicks: popular(clicks), events: popular(events) };
}

export interface GoalVisitorRow { visitor: string; firstAt: string; pages: string[]; converted: boolean }
export async function goalVisitorRows(spec: MetricSpec): Promise<GoalVisitorRow[]> {
  const sql = await db();
  const userId = scopeUser();
  const rows = await sql`
    with mode as (select not exists (select 1 from kismet.events where user_id = ${userId} and at >= now() - interval '14 days' and synthetic = false) as all_synthetic),
    firsts as (select visitor, min(at) as first_at from kismet.events where user_id = ${userId} group by visitor),
    recent as (select e.* from kismet.events e, mode where e.user_id = ${userId} and e.at >= now() - interval '14 days' and (not e.synthetic or mode.all_synthetic))
    select r.visitor, f.first_at, array_agg(distinct r.page) filter (where r.name = 'view') as pages,
      bool_or(${converts(sql, spec)}) as converted
    from recent r join firsts f on f.visitor = r.visitor group by r.visitor, f.first_at
  `;
  return rows.map((r) => ({ visitor: String(r.visitor), firstAt: iso(r.first_at), pages: (r.pages as string[] | null) ?? [], converted: Boolean(r.converted) }));
}

export async function retentionCohort(): Promise<{ eligible: number; returned: number }> {
  const sql = await db();
  const userId = scopeUser();
  const [row] = await sql`
    with mode as (select not exists (select 1 from kismet.events where user_id = ${userId} and at >= now() - interval '14 days' and synthetic = false) as all_synthetic),
    eligible_events as (select e.* from kismet.events e, mode where e.user_id = ${userId} and (not e.synthetic or mode.all_synthetic)),
    firsts as (select visitor, min(at)::date as first_day from eligible_events group by visitor),
    cohort as (select * from firsts where first_day between current_date - 14 and current_date - 8)
    select count(*)::int as eligible, count(*) filter (where exists (
      select 1 from eligible_events e where e.user_id = ${userId} and e.visitor = c.visitor
        and e.at::date > c.first_day and e.at::date <= c.first_day + 7
    ))::int as returned from cohort c
  `;
  return { eligible: Number(row?.eligible ?? 0), returned: Number(row?.returned ?? 0) };
}

export interface DailyVisitors {
  day: string;
  control: number;
  treatment: number;
}

/** Distinct visitors per arm, one point per day, since the experiment started. */
export async function visitorSeries(flag: string, since: string): Promise<DailyVisitors[]> {
  const sql = await db();
  const rows = await sql<{ day: string; arm: string; visitors: number }[]>`
    select to_char(date_trunc('day', at), 'YYYY-MM-DD') as day,
           coalesce(arms ->> ${flag}, '') as arm,
           count(distinct visitor)::int as visitors
    from kismet.events
    where user_id = ${scopeUser()} and at >= ${since} and arms ? ${flag}
    group by 1, 2
    order by 1
  `;
  const byDay = new Map<string, DailyVisitors>();
  for (const row of rows) {
    const point = byDay.get(row.day) ?? { day: row.day, control: 0, treatment: 0 };
    if (row.arm === "control") point.control = Number(row.visitors);
    else if (row.arm === "treatment") point.treatment = Number(row.visitors);
    byDay.set(row.day, point);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface DailyMetricCount {
  day: string;
  series: string;
  visitors: number;
  conversions: number;
}

/** Daily distinct visitors and converters, grouped in SQL and bounded to the requested window. */
export async function dailyMetricCounts(
  spec: MetricSpec,
  from: string,
  to: string,
  options: { flag?: string; splitAt?: string } = {},
): Promise<DailyMetricCount[]> {
  const sql = await db();
  const userId = scopeUser();
  const flag = options.flag ?? null;
  const splitAt = options.splitAt ?? null;
  const rows = await sql`
    with mode as (
      select not exists (
        select 1 from kismet.events where user_id = ${userId} and at >= ${from} and at < ${to} and synthetic = false
      ) as include_synthetic
    ), eligible as (
      select e.* from kismet.events e, mode
      where e.user_id = ${userId} and e.at >= ${from} and e.at < ${to}
        and (not e.synthetic or mode.include_synthetic)
    ), audience as (
      select at::date as day, visitor,
        case when ${flag}::text is not null then arms ->> ${flag}
             when at < ${splitAt}::timestamptz then 'before' else 'after' end as series
      from eligible
      where (${flag}::text is null or arms ? ${flag})
      group by 1, 2, 3
    ), converted as (
      select at::date as day, visitor,
        case when ${flag}::text is not null then arms ->> ${flag}
             when at < ${splitAt}::timestamptz then 'before' else 'after' end as series
      from eligible
      where (${flag}::text is null or arms ? ${flag}) and ${converts(sql, spec)}
      group by 1, 2, 3
    )
    select to_char(a.day, 'YYYY-MM-DD') as day, a.series,
      count(*)::int as visitors, count(c.visitor)::int as conversions
    from audience a left join converted c using (day, visitor, series)
    where a.series is not null
    group by 1, 2 order by 1, 2
  `;
  return rows.map((row) => ({
    day: String(row.day), series: String(row.series), visitors: Number(row.visitors), conversions: Number(row.conversions),
  }));
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
  const rows = await sql`
    with exposed as (
      select visitor, min(arms ->> ${flag}) as arm, min(arms ->> ${other}) as other_arm
      from kismet.events
      where user_id = ${scopeUser()} and at >= ${since} and arms ? ${flag} and arms ? ${other}
      group by visitor
    ),
    converted as (
      select distinct e.visitor from kismet.events e
      where e.user_id = ${scopeUser()} and e.at >= ${since} and e.arms ? ${flag} and ${converts(sql, spec)}
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
    with clicks as (
      select page, element, count(distinct visitor)::int as clickers, max(at) as last_click_at
      from kismet.events where user_id = ${scopeUser()} and name = 'click' and at > now() - make_interval(days => ${sinceDays})
      group by page, element
      having max(at) >= now() - make_interval(days => ${ELEMENT_GONE_DAYS})
    ),
    element_views as (
      select c.page, c.element, c.clickers, count(distinct v.visitor)::int as visitors, bool_and(v.synthetic) as synthetic
      from clicks c join kismet.events v on v.user_id = ${scopeUser()} and v.name = 'view' and v.page = c.page
        and v.at > now() - make_interval(days => ${sinceDays}) and v.at <= c.last_click_at
      group by c.page, c.element, c.clickers
      having count(distinct v.visitor) >= ${minVisitors}
    )
    select page, element, visitors, clickers, synthetic from element_views
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
