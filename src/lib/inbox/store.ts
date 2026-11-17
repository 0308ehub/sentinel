import "server-only";

import postgres from "postgres";
import { askForJson } from "@/lib/ai/respond";
import { autopilotConfigured, db, newId } from "@/lib/autopilot/db";
import type { EvidenceLink } from "@/lib/inbox/producers";
import { mockCandidates } from "@/lib/inbox/producers";
import {
  isHeldBack,
  judge,
  nextWeight,
  selectDelivery,
  shouldOpenSession,
  withinWorkingHours,
  type Judged,
  type NotifyMode,
  type WorkKind,
} from "@/lib/inbox/score";
import { PALETTE, SEED_AGENTS, SIGNAL_TYPES, markLetter, previousSeedColor } from "@/lib/inbox/roster";
import type { AgentPatch, InboxAgent, InboxMessage, InboxPrefs, InboxThread } from "@/lib/inbox/types";
import * as memory from "@/lib/inbox/memory";

export type { InboxAgent, InboxMessage, InboxPrefs, InboxThread };

const INTERRUPTION_COST = 0.05;
const DEFAULTS = SEED_AGENTS.map((agent) => ({
  slug: agent.slug,
  name: agent.name,
  icon: agent.letter,
  color: agent.color,
  instructions: agent.instructions,
}));
const TYPES = SIGNAL_TYPES;
const COLORS: readonly string[] = PALETTE;

export class InboxError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function inboxReady(): boolean {
  return autopilotConfigured();
}

type Row = Record<string, unknown>;
type Sql = postgres.Sql;

const iso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value ?? ""));

function agentFrom(row: Row): InboxAgent {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    icon: String(row.icon ?? ""),
    color: String(row.color ?? "#0571d3"),
    instructions: String(row.instructions ?? ""),
    spec: String(row.spec ?? ""),
    boost: Number(row.boost ?? 1) || 1,
    pinned: Boolean(row.pinned),
    muted: Boolean(row.muted),
    ignoredStreak: Number(row.ignored_streak ?? 0),
  };
}

function confidenceLabel(value: number): string {
  if (value >= 0.75) return "Fairly sure";
  if (value >= 0.45) return "A reasonable guess";
  return "Just a hunch";
}

async function sqlFor(): Promise<Sql> {
  if (!inboxReady()) throw new InboxError("Agents need a database. Set KISMET_DATABASE_URL.", 503);
  return db();
}

function localDay(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

export async function ensureInbox(userId: string): Promise<void> {
  const sql = await sqlFor();
  await sql`alter table kismet.inbox_agents add column if not exists spec text not null default ''`;
  await sql`alter table kismet.inbox_agents add column if not exists boost real not null default 1`;
  await sql`alter table kismet.inbox_threads add column if not exists pin_order integer not null default 0`;
  await sql`
    create table if not exists kismet.inbox_removed (
      user_id text not null,
      slug text not null,
      primary key (user_id, slug)
    )
  `;
  await sql`insert into kismet.inbox_prefs (user_id) values (${userId}) on conflict (user_id) do nothing`;
  for (const type of TYPES) {
    await sql`
      insert into kismet.inbox_weights (user_id, signal_type) values (${userId}, ${type})
      on conflict (user_id, signal_type) do nothing
    `;
  }
  const removed = await sql<{ slug: string }[]>`select slug from kismet.inbox_removed where user_id = ${userId}`;
  const gone = new Set(removed.map((row) => row.slug));
  for (const agent of DEFAULTS) {
    if (gone.has(agent.slug)) continue;
    const id = `${userId}__${agent.slug}`;
    const threadId = `${userId}__direct__${agent.slug}`;
    await sql`
      insert into kismet.inbox_agents (id, user_id, slug, name, icon, color, instructions)
      values (${id}, ${userId}, ${agent.slug}, ${agent.name}, ${agent.icon}, ${agent.color}, ${agent.instructions})
      on conflict (id) do nothing
    `;
    await sql`
      insert into kismet.inbox_threads (id, user_id, key, kind, title)
      values (${threadId}, ${userId}, ${`direct:${agent.slug}`}, ${"direct"}, ${agent.name})
      on conflict (id) do nothing
    `;
    await sql`
      insert into kismet.inbox_members (thread_id, agent_id) values (${threadId}, ${id})
      on conflict do nothing
    `;
    const legacy = agent.icon === "I" ? "In" : agent.icon === "E" ? "Ex" : agent.icon === "P" ? "Pr" : agent.icon === "M" ? "Mo" : "";
    if (legacy) {
      await sql`
        update kismet.inbox_agents
        set icon = ${agent.icon}, color = ${agent.color}
        where id = ${id} and icon = ${legacy}
      `;
    }
    const previous = previousSeedColor(agent.slug);
    if (previous) {
      await sql`
        update kismet.inbox_agents
        set color = ${agent.color}
        where id = ${id} and lower(color) = ${previous}
      `;
    }
  }
}

async function agentsOf(sql: Sql, userId: string): Promise<InboxAgent[]> {
  const rows = await sql<Row[]>`select * from kismet.inbox_agents where user_id = ${userId} order by created_at`;
  return rows.map(agentFrom);
}

async function prefsRow(sql: Sql, userId: string): Promise<Row> {
  const rows = await sql<Row[]>`select * from kismet.inbox_prefs where user_id = ${userId}`;
  return rows[0] ?? {};
}

function modeOf(value: unknown): NotifyMode {
  return value === "hours" || value === "always" || value === "session" ? value : "session";
}

async function weightMap(sql: Sql, userId: string): Promise<Map<string, number>> {
  const rows = await sql<Row[]>`select signal_type, weight from kismet.inbox_weights where user_id = ${userId}`;
  return new Map(rows.map((row) => [String(row.signal_type), Number(row.weight ?? 1)]));
}

function interruptsUsed(row: Row, now: Date): number {
  const offset = Number(row.tz_offset ?? 0);
  if (String(row.interrupts_day ?? "") !== localDay(now, offset)) return 0;
  return Number(row.interrupts_today ?? 0);
}

export async function listInbox(userId: string, tzOffset?: number) {
  if (!inboxReady()) return memory.listInbox(userId, tzOffset);
  await ensureInbox(userId);
  const sql = await sqlFor();
  if (typeof tzOffset === "number" && Number.isFinite(tzOffset)) {
    await sql`update kismet.inbox_prefs set tz_offset = ${Math.trunc(tzOffset)} where user_id = ${userId}`;
  }
  const agents = await agentsOf(sql, userId);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const threads = await sql<Row[]>`select * from kismet.inbox_threads where user_id = ${userId}`;
  const members = await sql<Row[]>`
    select m.thread_id, m.agent_id from kismet.inbox_members m
    join kismet.inbox_threads t on t.id = m.thread_id
    where t.user_id = ${userId}
  `;
  const latest = await sql<Row[]>`
    select distinct on (thread_id) thread_id, body, created_at
    from kismet.inbox_messages
    where user_id = ${userId} and type <> 'SYSTEM_STATUS'
    order by thread_id, created_at desc
  `;
  const unreadRows = await sql<Row[]>`
    select thread_id, count(*)::int as n
    from kismet.inbox_messages
    where user_id = ${userId} and sender = 'agent' and read_at is null and type <> 'SYSTEM_STATUS'
    group by thread_id
  `;
  const status = await sql<Row[]>`select * from kismet.inbox_status where user_id = ${userId}`;
  const quietRows = await sql<Row[]>`
    select f.id, f.title, f.explanation, a.name as agent_name
    from kismet.inbox_findings f
    join kismet.inbox_agents a on a.id = f.agent_id
    where f.user_id = ${userId} and f.status = 'logged'
    order by f.created_at desc
    limit 20
  `;
  const latestBy = new Map(latest.map((row) => [String(row.thread_id), row]));
  const unreadBy = new Map(unreadRows.map((row) => [String(row.thread_id), Number(row.n ?? 0)]));
  const fresh = Date.now() - 2 * 60_000;
  const live = new Map(
    status
      .filter((row) => row.run_id && Date.parse(iso(row.updated_at)) > fresh)
      .map((row) => [String(row.agent_id), String(row.activity || "Working")]),
  );
  const memberIds = new Map<string, string[]>();
  for (const row of members) {
    const list = memberIds.get(String(row.thread_id)) ?? [];
    list.push(String(row.agent_id));
    memberIds.set(String(row.thread_id), list);
  }
  const mapped: InboxThread[] = threads.map((row) => {
    const people = (memberIds.get(String(row.id)) ?? []).flatMap((id) => {
      const agent = byId.get(id);
      return agent ? [agent] : [];
    });
    const running = people.map((agent) => live.get(agent.id)).find(Boolean) ?? null;
    const last = latestBy.get(String(row.id));
    return {
      id: String(row.id),
      kind: row.kind === "pod" ? "pod" : "direct",
      title: String(row.title || people.map((agent) => agent.name).join(", ")),
      pinned: Boolean(row.pinned) || (row.kind !== "pod" && people.some((agent) => agent.pinned)),
      pinOrder: Number(row.pin_order ?? 0),
      updatedAt: iso(row.updated_at),
      preview: running ?? (last ? String(last.body ?? "") : ""),
      previewAt: last ? iso(last.created_at) : null,
      unread: unreadBy.get(String(row.id)) ?? 0,
      typing: Boolean(running),
      agents: people,
    } satisfies InboxThread;
  });
  mapped.sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
  return {
    threads: mapped,
    agents,
    quiet: quietRows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      agentName: String(row.agent_name),
      explanation: String(row.explanation ?? ""),
    })),
    attention: mapped.reduce((sum, thread) => sum + (thread.unread > 0 ? 1 : 0), 0),
    slackAvailable: process.env.INBOX_SLACK === "1",
  };
}

export async function attentionCount(userId: string): Promise<number> {
  if (!inboxReady()) return memory.attentionCount(userId);
  const inbox = await listInbox(userId);
  return inbox.attention;
}

export async function threadMessages(userId: string, threadId: string): Promise<InboxMessage[]> {
  if (!inboxReady()) return memory.threadMessages(userId, threadId);
  await ensureInbox(userId);
  const sql = await sqlFor();
  const owned = await sql<Row[]>`select id from kismet.inbox_threads where id = ${threadId} and user_id = ${userId}`;
  if (!owned[0]) throw new InboxError("Thread not found.", 404);
  await sql`
    update kismet.inbox_messages set read_at = now()
    where thread_id = ${threadId} and user_id = ${userId} and sender = 'agent' and read_at is null
  `;
  const rows = await sql<Row[]>`
    select * from kismet.inbox_messages where thread_id = ${threadId} and user_id = ${userId}
    order by created_at asc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    sender: row.sender === "user" ? "user" : "agent",
    agentId: row.agent_id == null ? null : String(row.agent_id),
    type: String(row.type) as InboxMessage["type"],
    body: String(row.body ?? ""),
    signalId: row.signal_id == null ? null : String(row.signal_id),
    replyTo: row.reply_to == null ? null : String(row.reply_to),
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : null,
    createdAt: iso(row.created_at),
  }));
}

async function insertMessage(
  sql: Sql,
  input: {
    threadId: string;
    userId: string;
    agentId?: string | null;
    sender: "user" | "agent";
    type: InboxMessage["type"];
    body: string;
    signalId?: string | null;
    replyTo?: string | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<void> {
  await sql`
    insert into kismet.inbox_messages
      (id, thread_id, user_id, agent_id, sender, type, body, signal_id, reply_to, payload)
    values (
      ${newId("msg")}, ${input.threadId}, ${input.userId}, ${input.agentId ?? null}, ${input.sender},
      ${input.type}, ${input.body.slice(0, 2000)}, ${input.signalId ?? null}, ${input.replyTo ?? null},
      ${input.payload ? sql.json(input.payload as postgres.JSONValue) : null}
    )
  `;
  await sql`update kismet.inbox_threads set updated_at = now() where id = ${input.threadId}`;
}

async function setRun(sql: Sql, userId: string, agentId: string, activity: string, runId: string | null): Promise<void> {
  await sql`
    insert into kismet.inbox_status (user_id, agent_id, activity, run_id, updated_at)
    values (${userId}, ${agentId}, ${activity.slice(0, 160)}, ${runId}, now())
    on conflict (user_id, agent_id) do update
    set activity = excluded.activity, run_id = excluded.run_id, updated_at = now()
  `;
}

function cardPayload(row: Row, status: string): Record<string, unknown> {
  const evidence = Array.isArray(row.evidence) ? (row.evidence as EvidenceLink[]) : [];
  return {
    title: String(row.title),
    summary: String(row.summary ?? ""),
    hypothesis: String(row.hypothesis ?? ""),
    proposedAction: String(row.proposed_action ?? ""),
    confidence: Number(row.confidence ?? 0),
    confidenceLabel: confidenceLabel(Number(row.confidence ?? 0)),
    evidence,
    explanation: String(row.explanation ?? ""),
    status,
  };
}

async function deliver(userId: string, sessionStart: boolean): Promise<void> {
  const sql = await sqlFor();
  const now = new Date();
  const prefs = await prefsRow(sql, userId);
  const mode = modeOf(prefs.mode);
  const offset = Number(prefs.tz_offset ?? 0);
  const hours = withinWorkingHours(now, Number(prefs.work_start ?? 9), Number(prefs.work_end ?? 18), offset);
  const weights = await weightMap(sql, userId);
  const agents = await agentsOf(sql, userId);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const queued = await sql<Row[]>`select * from kismet.inbox_findings where user_id = ${userId} and status = 'queued'`;
  const sentRows = await sql<Row[]>`
    select id, semantic_key, snooze_until from kismet.inbox_findings
    where user_id = ${userId} and status in ('sent', 'dismissed', 'approved', 'logged', 'snoozed')
  `;
  const sent = {
    ids: new Set(sentRows.map((row) => String(row.id))),
    keys: new Set(sentRows.map((row) => String(row.semantic_key))),
  };
  const judged: (Judged & { row: Row })[] = [];
  const left = Math.max(0, Number(prefs.daily_interrupt_budget ?? 3) - interruptsUsed(prefs, now));
  for (const row of queued) {
    const snooze = row.snooze_until ? Date.parse(iso(row.snooze_until)) : null;
    if (isHeldBack({ id: String(row.id), semanticKey: String(row.semantic_key), snoozeUntil: snooze }, sent, now.getTime())) continue;
    const agent = byId.get(String(row.agent_id));
    const decision = judge({
      id: String(row.id),
      evidence: Number(row.confidence ?? 0),
      impact: Number(row.impact ?? 0),
      urgency: Number(row.urgency ?? 0),
      relevance: (weights.get(String(row.type)) ?? 1) * (agent?.boost || 1),
      interruptionCost: INTERRUPTION_COST,
      ignoredStreak: agent?.ignoredStreak ?? 0,
      muted: agent?.muted ?? false,
      interruptsLeft: left,
    });
    judged.push({ ...decision, row });
    await sql`
      update kismet.inbox_findings
      set tier = ${decision.tier}, score = ${decision.score}, explanation = ${decision.explanation},
          status = ${decision.tier === "LOG" ? "logged" : "queued"}
      where id = ${String(row.id)}
    `;
  }
  const chosen = selectDelivery(judged.filter((item) => item.tier !== "LOG"), {
    mode,
    withinHours: hours,
    sessionStart,
    cap: Number(prefs.session_cap ?? 4),
    interruptsLeft: left,
  });
  const byFinding = new Map(judged.map((item) => [item.id, item]));
  let interrupts = 0;
  for (const item of chosen) {
    const found = byFinding.get(item.id);
    if (!found) continue;
    const agent = byId.get(String(found.row.agent_id));
    if (!agent) continue;
    const owned = await sql<Row[]>`
      select id from kismet.inbox_threads where user_id = ${userId} and key = ${`direct:${agent.slug}`}
    `;
    const threadId = owned[0] ? String(owned[0].id) : "";
    if (!threadId) continue;
    const activity = String(found.row.activity ?? "").trim();
    if (activity) {
      await insertMessage(sql, { threadId, userId, agentId: agent.id, sender: "agent", type: "SYSTEM_STATUS", body: activity, signalId: item.id });
    }
    const intro = String(found.row.intro ?? "").trim();
    const title = String(found.row.title ?? "").trim();
    const summary = String(found.row.summary ?? "").trim();
    if (intro && intro !== title && intro !== summary) {
      await insertMessage(sql, { threadId, userId, agentId: agent.id, sender: "agent", type: "TEXT", body: intro, signalId: item.id });
    }
    await insertMessage(sql, {
      threadId,
      userId,
      agentId: agent.id,
      sender: "agent",
      type: "SIGNAL_CARD",
      body: title,
      signalId: item.id,
      payload: cardPayload({ ...found.row, explanation: found.explanation }, "sent"),
    });
    await sql`update kismet.inbox_findings set status = 'sent', tier = ${item.tier} where id = ${item.id}`;
    await sql`insert into kismet.inbox_finding_events (finding_id, user_id, kind, detail) values (${item.id}, ${userId}, ${"shown"}, ${item.tier})`;
    if (item.tier === "INTERRUPT") {
      interrupts += 1;
      await slackInterrupt(String(prefs.slack_interrupts), String(prefs.slack_channel ?? ""), agent.name, title, summary);
    }
  }
  if (interrupts > 0) {
    await sql`
      update kismet.inbox_prefs
      set interrupts_today = ${interruptsUsed(prefs, now) + interrupts}, interrupts_day = ${localDay(now, offset)}
      where user_id = ${userId}
    `;
  }
}

async function slackInterrupt(enabled: string, channel: string, name: string, title: string, summary: string): Promise<void> {
  if (process.env.INBOX_SLACK !== "1" || enabled !== "true") return;
  const target = channel.trim();
  if (!target) return;
  try {
    const { postSlackMessage } = await import("@/lib/slack/client");
    await postSlackMessage(target, `${name}: ${title}. ${summary}`.slice(0, 500));
  } catch {
    // The thread already has the message.
  }
}

async function ingest(userId: string): Promise<void> {
  const sql = await sqlFor();
  const agents = await agentsOf(sql, userId);
  const bySlug = new Map(agents.map((agent) => [agent.slug, agent]));
  for (const candidate of mockCandidates()) {
    const agent = bySlug.get(candidate.agentSlug);
    if (!agent) continue;
    await sql`
      insert into kismet.inbox_findings (
        id, user_id, agent_id, type, semantic_key, title, summary, hypothesis, proposed_action,
        intro, activity, confidence, impact, urgency, evidence, status
      ) values (
        ${newId("find")}, ${userId}, ${agent.id}, ${candidate.type}, ${candidate.semanticKey},
        ${candidate.title}, ${candidate.summary}, ${candidate.hypothesis}, ${candidate.proposedAction},
        ${candidate.intro}, ${candidate.activity}, ${candidate.confidence}, ${candidate.impact}, ${candidate.urgency},
        ${sql.json(candidate.evidence as unknown as postgres.JSONValue)}, ${"open"}
      )
      on conflict (user_id, semantic_key) do nothing
    `;
  }
  const open = await sql<Row[]>`select * from kismet.inbox_findings where user_id = ${userId} and status = 'open'`;
  const weights = await weightMap(sql, userId);
  const prefs = await prefsRow(sql, userId);
  const now = new Date();
  const left = Math.max(0, Number(prefs.daily_interrupt_budget ?? 3) - interruptsUsed(prefs, now));
  for (const row of open) {
    const agent = agents.find((item) => item.id === String(row.agent_id));
    const decision = judge({
      id: String(row.id),
      evidence: Number(row.confidence ?? 0),
      impact: Number(row.impact ?? 0),
      urgency: Number(row.urgency ?? 0),
      relevance: (weights.get(String(row.type)) ?? 1) * (agent?.boost || 1),
      interruptionCost: INTERRUPTION_COST,
      ignoredStreak: agent?.ignoredStreak ?? 0,
      muted: agent?.muted ?? false,
      interruptsLeft: left,
    });
    await sql`
      update kismet.inbox_findings
      set tier = ${decision.tier}, score = ${decision.score}, explanation = ${decision.explanation},
          status = ${decision.tier === "LOG" ? "logged" : "queued"}
      where id = ${String(row.id)}
    `;
  }
}

export async function noteWork(userId: string, kind: WorkKind, tzOffset?: number): Promise<void> {
  if (!inboxReady()) return memory.noteWork(userId, kind, tzOffset);
  await ensureInbox(userId);
  const sql = await sqlFor();
  if (typeof tzOffset === "number" && Number.isFinite(tzOffset)) {
    await sql`update kismet.inbox_prefs set tz_offset = ${Math.trunc(tzOffset)} where user_id = ${userId}`;
  }
  const prefs = await prefsRow(sql, userId);
  const now = new Date();
  const mode = modeOf(prefs.mode);
  const offset = Number(prefs.tz_offset ?? 0);
  const hours = withinWorkingHours(now, Number(prefs.work_start ?? 9), Number(prefs.work_end ?? 18), offset);
  const last = prefs.last_meaningful_at ? Date.parse(iso(prefs.last_meaningful_at)) : null;
  const idleMs = Number(prefs.idle_hours ?? 2) * 60 * 60 * 1000;
  const opening = shouldOpenSession({ kind, lastAt: last, now: now.getTime(), idleMs, withinHours: hours, mode });
  const inSession = prefs.session_open_until ? Date.parse(iso(prefs.session_open_until)) > now.getTime() : false;
  const meaningful = kind === "reply" || kind === "card" || kind === "edit";
  if (meaningful && (hours || mode === "always")) {
    await sql`
      update kismet.inbox_prefs
      set last_meaningful_at = ${now.toISOString()}, session_open_until = ${new Date(now.getTime() + idleMs).toISOString()}
      where user_id = ${userId}
    `;
  }
  if (opening) {
    await ingest(userId);
    await deliver(userId, true);
  } else if (inSession && meaningful) {
    await deliver(userId, false);
  }
}

async function compose(agent: InboxAgent, transcript: string): Promise<string[]> {
  try {
    const raw = await askForJson(
      [
        `You are ${agent.name}, texting a product manager.`,
        agent.instructions,
        agent.spec ? `Specifications: ${agent.spec}` : "",
        "Reply as 1 or 2 short texts, separated by a blank line.",
        "No emoji. No greeting. No sign-off. No claims that are not in the thread.",
        "If the thread does not support an answer, say you will look.",
      ].filter(Boolean).join(" "),
      transcript.slice(0, 6000),
      false,
      undefined,
      "chat",
    );
    const parts = raw
      .split(/\n\s*\n/)
      .map((part) => part.replace(/^["']|["']$/g, "").trim())
      .filter(Boolean)
      .slice(0, 2);
    if (parts.length) return parts.map((part) => part.slice(0, 400));
  } catch {
    // A missing model still keeps the user's text in the thread.
  }
  return ["I'll look. I'll text you if it's worth sending."];
}

export async function sendMessage(userId: string, threadId: string, body: string, replyTo?: string | null, tzOffset?: number): Promise<void> {
  if (!inboxReady()) return memory.sendMessage(userId, threadId, body, replyTo, tzOffset);
  const text = body.trim().slice(0, 2000);
  if (!text) throw new InboxError("Write a message first.");
  await ensureInbox(userId);
  const sql = await sqlFor();
  const threads = await sql<Row[]>`select * from kismet.inbox_threads where id = ${threadId} and user_id = ${userId}`;
  const thread = threads[0];
  if (!thread) throw new InboxError("Thread not found.", 404);
  const memberRows = await sql<Row[]>`select agent_id from kismet.inbox_members where thread_id = ${threadId}`;
  const agents = await agentsOf(sql, userId);
  const people = memberRows.flatMap((row) => {
    const agent = agents.find((item) => item.id === String(row.agent_id));
    return agent ? [agent] : [];
  });
  if (!people.length) throw new InboxError("This thread has no one in it.");
  await insertMessage(sql, { threadId, userId, sender: "user", type: "TEXT", body: text, replyTo: replyTo ?? null });
  const prior = await sql<Row[]>`
    select id, sender, body, type, payload from kismet.inbox_messages
    where thread_id = ${threadId} and user_id = ${userId}
    order by created_at desc limit 12
  `;
  let cardNote = "";
  if (replyTo) {
    const card = prior.find((row) => String(row.id) === replyTo);
    if (card?.payload) cardNote = `\nCard: ${JSON.stringify(card.payload).slice(0, 1500)}`;
  }
  const history = [...prior]
    .reverse()
    .filter((row) => row.type === "TEXT" || row.type === "SIGNAL_CARD")
    .map((row) => `${row.sender === "user" ? "You" : "Agent"}: ${String(row.body)}`)
    .join("\n");
  const speaker = people[0];
  const runId = newId("run");
  await setRun(sql, userId, speaker.id, "Writing", runId);
  try {
    const lines = await compose(speaker, `${history}${cardNote}`);
    for (const line of lines) {
      await insertMessage(sql, { threadId, userId, agentId: speaker.id, sender: "agent", type: "TEXT", body: line, replyTo: replyTo ?? null });
    }
    const other = people[1];
    const fallback = lines.length === 1 && lines[0].startsWith("I'll look.");
    if (thread.kind === "pod" && other && !fallback) {
      await setRun(sql, userId, other.id, "Writing", runId);
      const second = await compose(other, `${history}\n${speaker.name}: ${lines.join(" ")}`);
      if (!(second.length === 1 && second[0].startsWith("I'll look."))) {
        for (const line of second) {
          await insertMessage(sql, { threadId, userId, agentId: other.id, sender: "agent", type: "TEXT", body: line });
        }
      }
    }
  } finally {
    for (const agent of people) await setRun(sql, userId, agent.id, "", null);
  }
  await noteWork(userId, "reply", tzOffset);
}

export async function actOnFinding(userId: string, findingId: string, action: "approve" | "snooze" | "dismiss" | "never", tzOffset?: number): Promise<void> {
  if (!inboxReady()) return memory.actOnFinding(userId, findingId, action, tzOffset);
  await ensureInbox(userId);
  const sql = await sqlFor();
  const rows = await sql<Row[]>`select * from kismet.inbox_findings where id = ${findingId} and user_id = ${userId}`;
  const finding = rows[0];
  if (!finding) throw new InboxError("That note is gone.", 404);
  const type = String(finding.type);
  const weightRows = await sql<Row[]>`select weight from kismet.inbox_weights where user_id = ${userId} and signal_type = ${type}`;
  const current = Number(weightRows[0]?.weight ?? 1);
  let status = "dismissed";
  if (action === "snooze") {
    const until = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await sql`update kismet.inbox_findings set status = 'snoozed', snooze_until = ${until} where id = ${findingId}`;
    await sql`insert into kismet.inbox_finding_events (finding_id, user_id, kind) values (${findingId}, ${userId}, ${"snoozed"})`;
    status = "snoozed";
  } else if (action === "approve") {
    await sql`update kismet.inbox_findings set status = 'approved' where id = ${findingId}`;
    await sql`
      insert into kismet.inbox_weights (user_id, signal_type, weight) values (${userId}, ${type}, ${nextWeight(current, "approve")})
      on conflict (user_id, signal_type) do update set weight = excluded.weight
    `;
    await sql`update kismet.inbox_agents set ignored_streak = 0 where id = ${String(finding.agent_id)}`;
    await sql`insert into kismet.inbox_finding_events (finding_id, user_id, kind) values (${findingId}, ${userId}, ${"acted"})`;
    status = "approved";
  } else {
    const never = action === "never";
    await sql`update kismet.inbox_findings set status = 'dismissed' where id = ${findingId}`;
    await sql`
      insert into kismet.inbox_weights (user_id, signal_type, weight)
      values (${userId}, ${type}, ${nextWeight(current, never ? "never" : "dismiss")})
      on conflict (user_id, signal_type) do update set weight = excluded.weight
    `;
    if (never) await sql`update kismet.inbox_agents set ignored_streak = 6 where id = ${String(finding.agent_id)}`;
    else await sql`update kismet.inbox_agents set ignored_streak = ignored_streak + 1 where id = ${String(finding.agent_id)}`;
    await sql`insert into kismet.inbox_finding_events (finding_id, user_id, kind) values (${findingId}, ${userId}, ${"dismissed"})`;
  }
  await sql`
    update kismet.inbox_messages
    set payload = coalesce(payload, '{}'::jsonb) || ${sql.json({ status } as postgres.JSONValue)}
    where user_id = ${userId} and signal_id = ${findingId}
  `;
  await noteWork(userId, "card", tzOffset);
}

async function draftAgent(prompt: string, index: number) {
  const fallback = {
    name: prompt.trim().split(/[.\n]/)[0]?.trim().slice(0, 32) || "Agent",
    icon: (prompt.trim()[0] || "A").toUpperCase(),
    color: COLORS[index % COLORS.length],
    instructions: prompt.trim().slice(0, 400),
  };
  try {
    const raw = await askForJson(
      "Turn this into one agent. Return JSON with name, icon (one capital letter), color (hex), and instructions (one sentence about when they should text).",
      prompt.slice(0, 500),
      false,
      { type: "object", properties: { name: { type: "string" }, icon: { type: "string" }, color: { type: "string" }, instructions: { type: "string" } }, required: ["name", "instructions"] },
      "chat",
    );
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) return fallback;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { name?: string; icon?: string; color?: string; instructions?: string };
    const color = /^#[0-9a-fA-F]{6}$/.test(parsed.color ?? "") ? (parsed.color as string) : fallback.color;
    return {
      name: (parsed.name || fallback.name).trim().slice(0, 48),
      icon: (parsed.icon || fallback.icon).trim().slice(0, 1).toUpperCase(),
      color,
      instructions: (parsed.instructions || fallback.instructions).trim().slice(0, 400),
    };
  } catch {
    return fallback;
  }
}

export async function createAgent(userId: string, prompt: string): Promise<string> {
  if (!inboxReady()) return memory.createAgent(userId, prompt);
  const text = prompt.trim();
  if (!text) throw new InboxError("Describe the agent first.");
  await ensureInbox(userId);
  const sql = await sqlFor();
  const existing = await agentsOf(sql, userId);
  const draft = await draftAgent(text, existing.length);
  const slug = `custom-${newId("ag").slice(3, 10)}`;
  const id = newId("ag");
  const threadId = newId("th");
  await sql`
    insert into kismet.inbox_agents (id, user_id, slug, name, icon, color, instructions)
    values (${id}, ${userId}, ${slug}, ${draft.name}, ${draft.icon}, ${draft.color}, ${draft.instructions})
  `;
  await sql`
    insert into kismet.inbox_threads (id, user_id, key, kind, title)
    values (${threadId}, ${userId}, ${`direct:${slug}`}, ${"direct"}, ${draft.name})
  `;
  await sql`insert into kismet.inbox_members (thread_id, agent_id) values (${threadId}, ${id})`;
  return threadId;
}

export async function updateAgent(
  userId: string,
  agentId: string,
  patch: AgentPatch,
): Promise<void> {
  if (!inboxReady()) return memory.updateAgent(userId, agentId, patch);
  await ensureInbox(userId);
  const sql = await sqlFor();
  const rows = await sql<Row[]>`select * from kismet.inbox_agents where id = ${agentId} and user_id = ${userId}`;
  const agent = rows[0];
  if (!agent) throw new InboxError("Agent not found.", 404);
  const name = (patch.name ?? String(agent.name)).trim().slice(0, 48) || String(agent.name);
  const icon = markLetter(patch.icon ?? String(agent.icon), name);
  const color = patch.color && /^#[0-9a-fA-F]{6}$/.test(patch.color) ? patch.color : String(agent.color);
  const pinned = patch.pinned ?? Boolean(agent.pinned);
  const muted = patch.muted ?? Boolean(agent.muted);
  const instructions = (patch.instructions ?? String(agent.instructions ?? "")).trim().slice(0, 600);
  const spec = (patch.spec ?? String(agent.spec ?? "")).trim().slice(0, 600);
  const boost = patch.boost != null && Number.isFinite(patch.boost) ? Math.min(2, Math.max(0.25, patch.boost)) : Number(agent.boost ?? 1) || 1;
  await sql`
    update kismet.inbox_agents
    set name = ${name}, icon = ${icon}, color = ${color}, pinned = ${pinned}, muted = ${muted},
        instructions = ${instructions}, spec = ${spec}, boost = ${boost}
    where id = ${agentId}
  `;
  await sql`
    update kismet.inbox_threads set title = ${name}, pinned = ${pinned}
    where user_id = ${userId} and key = ${`direct:${String(agent.slug)}`}
  `;
}

export async function createPod(userId: string, title: string, agentIds: string[]): Promise<string> {
  if (!inboxReady()) return memory.createPod(userId, title, agentIds);
  const name = title.trim().slice(0, 48);
  const ids = [...new Set(agentIds)].slice(0, 8);
  if (!name) throw new InboxError("Name the pod first.");
  if (ids.length < 2) throw new InboxError("A pod needs two agents.");
  await ensureInbox(userId);
  const sql = await sqlFor();
  const known = new Set((await agentsOf(sql, userId)).map((agent) => agent.id));
  if (ids.some((id) => !known.has(id))) throw new InboxError("Pick agents from this inbox.");
  const threadId = newId("pod");
  await sql`
    insert into kismet.inbox_threads (id, user_id, key, kind, title)
    values (${threadId}, ${userId}, ${`pod:${threadId}`}, ${"pod"}, ${name})
  `;
  for (const agentId of ids) {
    await sql`insert into kismet.inbox_members (thread_id, agent_id) values (${threadId}, ${agentId})`;
  }
  return threadId;
}

export async function readPrefs(userId: string): Promise<InboxPrefs> {
  if (!inboxReady()) return memory.readPrefs(userId);
  await ensureInbox(userId);
  const sql = await sqlFor();
  const row = await prefsRow(sql, userId);
  const weights = await sql<Row[]>`select signal_type, weight, autonomy from kismet.inbox_weights where user_id = ${userId} order by signal_type`;
  const agents = await agentsOf(sql, userId);
  return {
    mode: modeOf(row.mode),
    workStart: Number(row.work_start ?? 9),
    workEnd: Number(row.work_end ?? 18),
    tzOffset: Number(row.tz_offset ?? 0),
    idleHours: Number(row.idle_hours ?? 2),
    sessionCap: Number(row.session_cap ?? 4),
    dailyInterruptBudget: Number(row.daily_interrupt_budget ?? 3),
    slackInterrupts: Boolean(row.slack_interrupts),
    slackChannel: String(row.slack_channel ?? ""),
    weights: weights.map((item) => ({ type: String(item.signal_type), weight: Number(item.weight ?? 1), autonomy: String(item.autonomy ?? "NOTIFY_ONLY") })),
    agents: agents.map((agent) => ({ id: agent.id, name: agent.name, muted: agent.muted })),
  };
}

export async function writePrefs(
  userId: string,
  patch: Partial<Pick<InboxPrefs, "mode" | "workStart" | "workEnd" | "idleHours" | "sessionCap" | "dailyInterruptBudget" | "slackInterrupts" | "slackChannel">> & {
    weights?: { type: string; autonomy?: string }[];
    muted?: { id: string; muted: boolean }[];
  },
): Promise<InboxPrefs> {
  if (!inboxReady()) return memory.writePrefs(userId, patch);
  await ensureInbox(userId);
  const current = await readPrefs(userId);
  const sql = await sqlFor();
  const mode = patch.mode ?? current.mode;
  const workStart = clampNum(patch.workStart ?? current.workStart, 0, 23);
  const workEnd = clampNum(patch.workEnd ?? current.workEnd, 1, 24);
  const idleHours = clampNum(patch.idleHours ?? current.idleHours, 0.5, 24);
  const sessionCap = clampNum(patch.sessionCap ?? current.sessionCap, 3, 5);
  const budget = clampNum(patch.dailyInterruptBudget ?? current.dailyInterruptBudget, 0, 20);
  const slackInterrupts = patch.slackInterrupts ?? current.slackInterrupts;
  const slackChannel = (patch.slackChannel ?? current.slackChannel).slice(0, 80);
  await sql`
    update kismet.inbox_prefs set
      mode = ${mode}, work_start = ${workStart}, work_end = ${workEnd}, idle_hours = ${idleHours},
      session_cap = ${sessionCap}, daily_interrupt_budget = ${budget},
      slack_interrupts = ${slackInterrupts}, slack_channel = ${slackChannel}
    where user_id = ${userId}
  `;
  for (const weight of patch.weights ?? []) {
    const autonomy = weight.autonomy === "DRAFT" || weight.autonomy === "ACT_WITHIN_GUARDRAILS" ? weight.autonomy : "NOTIFY_ONLY";
    await sql`update kismet.inbox_weights set autonomy = ${autonomy} where user_id = ${userId} and signal_type = ${weight.type}`;
  }
  for (const agent of patch.muted ?? []) {
    await sql`update kismet.inbox_agents set muted = ${agent.muted} where id = ${agent.id} and user_id = ${userId}`;
  }
  return readPrefs(userId);
}

export async function pinThread(userId: string, threadId: string, pinned: boolean): Promise<void> {
  if (!inboxReady()) return memory.pinThread(userId, threadId, pinned);
  await ensureInbox(userId);
  const sql = await sqlFor();
  const rows = await sql<Row[]>`select * from kismet.inbox_threads where id = ${threadId} and user_id = ${userId}`;
  const thread = rows[0];
  if (!thread) throw new InboxError("Thread not found.", 404);
  await sql`update kismet.inbox_threads set pinned = ${pinned} where id = ${threadId}`;
  if (pinned) {
    const order = await sql<{ n: number }[]>`select coalesce(max(pin_order), -1) + 1 as n from kismet.inbox_threads where user_id = ${userId} and pinned = true`;
    await sql`update kismet.inbox_threads set pin_order = ${Number(order[0]?.n ?? 0)} where id = ${threadId}`;
  }
  if (String(thread.kind) === "direct") {
    const members = await sql<Row[]>`select agent_id from kismet.inbox_members where thread_id = ${threadId}`;
    const agentId = members[0] ? String(members[0].agent_id) : "";
    if (agentId) await sql`update kismet.inbox_agents set pinned = ${pinned} where id = ${agentId} and user_id = ${userId}`;
  }
}

export async function reorderPins(userId: string, ids: string[]): Promise<void> {
  if (!inboxReady()) return memory.reorderPins(userId, ids);
  await ensureInbox(userId);
  const sql = await sqlFor();
  for (let index = 0; index < ids.length; index += 1) {
    await sql`update kismet.inbox_threads set pin_order = ${index} where id = ${ids[index]} and user_id = ${userId}`;
  }
}

export async function deleteThread(userId: string, threadId: string): Promise<void> {
  if (!inboxReady()) return memory.deleteThread(userId, threadId);
  await ensureInbox(userId);
  const sql = await sqlFor();
  const rows = await sql<Row[]>`select * from kismet.inbox_threads where id = ${threadId} and user_id = ${userId}`;
  const thread = rows[0];
  if (!thread) throw new InboxError("Thread not found.", 404);
  if (String(thread.kind) === "direct") {
    const members = await sql<Row[]>`select agent_id from kismet.inbox_members where thread_id = ${threadId}`;
    const agentId = members[0] ? String(members[0].agent_id) : "";
    const agents = agentId ? await sql<Row[]>`select slug from kismet.inbox_agents where id = ${agentId} and user_id = ${userId}` : [];
    const slug = agents[0] ? String(agents[0].slug) : "";
    if (slug) await sql`insert into kismet.inbox_removed (user_id, slug) values (${userId}, ${slug}) on conflict do nothing`;
    if (agentId) {
      await sql`delete from kismet.inbox_findings where agent_id = ${agentId} and user_id = ${userId}`;
      await sql`delete from kismet.inbox_status where agent_id = ${agentId} and user_id = ${userId}`;
      await sql`delete from kismet.inbox_agents where id = ${agentId} and user_id = ${userId}`;
    }
  }
  await sql`delete from kismet.inbox_messages where thread_id = ${threadId} and user_id = ${userId}`;
  await sql`delete from kismet.inbox_members where thread_id = ${threadId}`;
  await sql`delete from kismet.inbox_threads where id = ${threadId} and user_id = ${userId}`;
}

function clampNum(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
