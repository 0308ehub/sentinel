import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { askForJson } from "@/lib/ai/respond";
import { newId } from "@/lib/autopilot/db";
import { mockCandidates } from "@/lib/inbox/producers";
import {
  isHeldBack,
  judge,
  nextWeight,
  selectDelivery,
  shouldOpenSession,
  withinWorkingHours,
  type NotifyMode,
  type WorkKind,
} from "@/lib/inbox/score";
import { PALETTE, SEED_AGENTS, SIGNAL_TYPES, markLetter, seedColor } from "@/lib/inbox/roster";
import type { AgentPatch, InboxAgent, InboxMessage, InboxPrefs, InboxThread } from "@/lib/inbox/types";

const FILE = path.join(process.cwd(), "data", "inbox.json");
const COST = 0.05;
const DEFAULTS = SEED_AGENTS.map((agent) => ({
  slug: agent.slug,
  name: agent.name,
  icon: agent.letter,
  color: agent.color,
  instructions: agent.instructions,
}));
const TYPES = SIGNAL_TYPES;
const COLORS: readonly string[] = PALETTE;

interface AgentRow extends InboxAgent { userId: string; createdAt: string }
interface ThreadRow { id: string; userId: string; key: string; kind: "direct" | "pod"; title: string; pinned: boolean; pinOrder: number; updatedAt: string }
interface Member { threadId: string; agentId: string }
interface MessageRow { id: string; threadId: string; userId: string; agentId: string | null; sender: "user" | "agent"; type: InboxMessage["type"]; body: string; signalId: string | null; replyTo: string | null; payload: Record<string, unknown> | null; readAt: string | null; createdAt: string }
interface Finding { id: string; userId: string; agentId: string; type: string; semanticKey: string; title: string; summary: string; hypothesis: string; proposedAction: string; intro: string; activity: string; confidence: number; impact: number; urgency: number; evidence: { title: string; href: string; kind: string }[]; status: string; tier: string; score: number; explanation: string; snoozeUntil: string | null }
interface Pref { userId: string; mode: NotifyMode; workStart: number; workEnd: number; tzOffset: number; idleHours: number; sessionCap: number; dailyInterruptBudget: number; slackInterrupts: boolean; slackChannel: string; lastMeaningfulAt: string | null; sessionOpenUntil: string | null; interruptsToday: number; interruptsDay: string }
interface Weight { userId: string; type: string; weight: number; autonomy: string }
interface Status { userId: string; agentId: string; activity: string; runId: string | null; updatedAt: string }
interface DB { agents: AgentRow[]; threads: ThreadRow[]; members: Member[]; messages: MessageRow[]; findings: Finding[]; prefs: Pref[]; weights: Weight[]; status: Status[]; removed: { userId: string; slug: string }[] }

const empty = (): DB => ({ agents: [], threads: [], members: [], messages: [], findings: [], prefs: [], weights: [], status: [], removed: [] });
let chain: Promise<unknown> = Promise.resolve();

async function withDb<T>(fn: (db: DB) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true });
    let db = empty();
    try {
      db = { ...empty(), ...JSON.parse(await readFile(FILE, "utf8")) } as DB;
    } catch {
      db = empty();
    }
    const result = await fn(db);
    await writeFile(FILE, JSON.stringify(db));
    return result;
  });
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function confidenceLabel(value: number): string {
  if (value >= 0.75) return "Fairly sure";
  if (value >= 0.45) return "A reasonable guess";
  return "Just a hunch";
}

function localDay(now: Date, offset: number): string {
  return new Date(now.getTime() + offset * 60_000).toISOString().slice(0, 10);
}

function ensure(db: DB, userId: string) {
  if (!db.removed) db.removed = [];
  for (const agent of db.agents) {
    if (agent.spec == null) agent.spec = "";
    if (typeof agent.boost !== "number") agent.boost = 1;
  }
  for (const thread of db.threads) {
    if (typeof thread.pinOrder !== "number") thread.pinOrder = 0;
  }
  if (!db.prefs.some((row) => row.userId === userId)) {
    db.prefs.push({ userId, mode: "session", workStart: 9, workEnd: 18, tzOffset: 0, idleHours: 2, sessionCap: 4, dailyInterruptBudget: 3, slackInterrupts: false, slackChannel: "", lastMeaningfulAt: null, sessionOpenUntil: null, interruptsToday: 0, interruptsDay: "" });
  }
  for (const type of TYPES) {
    if (!db.weights.some((row) => row.userId === userId && row.type === type)) db.weights.push({ userId, type, weight: 1, autonomy: "NOTIFY_ONLY" });
  }
  const gone = new Set(db.removed.filter((row) => row.userId === userId).map((row) => row.slug));
  for (const agent of DEFAULTS) {
    if (gone.has(agent.slug)) continue;
    const id = `${userId}__${agent.slug}`;
    if (!db.agents.some((row) => row.id === id)) {
      db.agents.push({ ...agent, id, userId, spec: "", boost: 1, pinned: false, muted: false, ignoredStreak: 0, createdAt: new Date().toISOString() });
    }
    const threadId = `${userId}__direct__${agent.slug}`;
    if (!db.threads.some((row) => row.id === threadId)) {
      db.threads.push({ id: threadId, userId, key: `direct:${agent.slug}`, kind: "direct", title: agent.name, pinned: false, pinOrder: 0, updatedAt: new Date().toISOString() });
    }
    if (!db.members.some((row) => row.threadId === threadId && row.agentId === id)) db.members.push({ threadId, agentId: id });
    const legacy = agent.icon === "I" ? "In" : agent.icon === "E" ? "Ex" : agent.icon === "P" ? "Pr" : agent.icon === "M" ? "Mo" : "";
    const saved = db.agents.find((row) => row.id === id);
    if (saved && ((legacy && saved.icon === legacy) || seedColor(agent.slug, saved.color) !== saved.color)) {
      if (legacy && saved.icon === legacy) saved.icon = agent.icon;
      saved.color = agent.color;
    }
  }
}

function agents(db: DB, userId: string): AgentRow[] {
  return db.agents.filter((row) => row.userId === userId);
}

function interruptsUsed(pref: Pref, now: Date): number {
  return pref.interruptsDay === localDay(now, pref.tzOffset) ? pref.interruptsToday : 0;
}

function toMessage(row: MessageRow): InboxMessage {
  return { id: row.id, sender: row.sender, agentId: row.agentId, type: row.type, body: row.body, signalId: row.signalId, replyTo: row.replyTo, payload: row.payload, createdAt: row.createdAt };
}

function pushMessage(db: DB, input: Omit<MessageRow, "id" | "createdAt" | "readAt">) {
  db.messages.push({ ...input, id: newId("msg"), readAt: null, createdAt: new Date().toISOString() });
  const thread = db.threads.find((row) => row.id === input.threadId);
  if (thread) thread.updatedAt = new Date().toISOString();
}

export async function listInbox(userId: string, tzOffset?: number) {
  return withDb((db) => {
    ensure(db, userId);
    const pref = db.prefs.find((row) => row.userId === userId)!;
    if (typeof tzOffset === "number" && Number.isFinite(tzOffset)) pref.tzOffset = Math.trunc(tzOffset);
    const people = agents(db, userId);
    const byId = new Map(people.map((agent) => [agent.id, agent]));
    const fresh = Date.now() - 2 * 60_000;
    const threads: InboxThread[] = db.threads.filter((row) => row.userId === userId).map((row) => {
      const members = db.members.filter((member) => member.threadId === row.id).flatMap((member) => {
        const agent = byId.get(member.agentId);
        return agent ? [agent] : [];
      });
      const live = members.map((agent) => db.status.find((item) => item.userId === userId && item.agentId === agent.id && item.runId && Date.parse(item.updatedAt) > fresh)).find(Boolean);
      const last = [...db.messages].reverse().find((message) => message.threadId === row.id && message.type !== "SYSTEM_STATUS");
      const unread = db.messages.filter((message) => message.threadId === row.id && message.sender === "agent" && !message.readAt && message.type !== "SYSTEM_STATUS").length;
      return {
        id: row.id,
        kind: row.kind,
        title: row.title || members.map((agent) => agent.name).join(", "),
        pinned: row.pinned || (row.kind !== "pod" && members.some((agent) => agent.pinned)),
        pinOrder: row.pinOrder ?? 0,
        updatedAt: row.updatedAt,
        preview: live?.activity || last?.body || "",
        previewAt: last?.createdAt ?? null,
        unread,
        typing: Boolean(live),
        agents: members,
      };
    });
    threads.sort((a, b) => ((a.unread > 0) === (b.unread > 0) ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt) : a.unread > 0 ? -1 : 1));
    return {
      threads,
      agents: people,
      quiet: db.findings.filter((row) => row.userId === userId && row.status === "logged").slice(-20).reverse().map((row) => ({
        id: row.id,
        title: row.title,
        agentName: byId.get(row.agentId)?.name ?? "",
        explanation: row.explanation,
      })),
      attention: threads.filter((thread) => thread.unread > 0).length,
      slackAvailable: false,
    };
  });
}

export async function attentionCount(userId: string): Promise<number> {
  const inbox = await listInbox(userId);
  return inbox.attention;
}

export async function threadMessages(userId: string, threadId: string): Promise<InboxMessage[]> {
  return withDb((db) => {
    ensure(db, userId);
    if (!db.threads.some((row) => row.id === threadId && row.userId === userId)) throw new Error("Thread not found.");
    for (const message of db.messages) {
      if (message.threadId === threadId && message.sender === "agent" && !message.readAt) message.readAt = new Date().toISOString();
    }
    return db.messages.filter((row) => row.threadId === threadId).map(toMessage);
  });
}

function deliver(db: DB, userId: string, sessionStart: boolean) {
  const pref = db.prefs.find((row) => row.userId === userId)!;
  const now = new Date();
  const hours = withinWorkingHours(now, pref.workStart, pref.workEnd, pref.tzOffset);
  const people = agents(db, userId);
  const weights = new Map(db.weights.filter((row) => row.userId === userId).map((row) => [row.type, row.weight]));
  const sent = {
    ids: new Set(db.findings.filter((row) => row.userId === userId && row.status !== "queued" && row.status !== "open").map((row) => row.id)),
    keys: new Set(db.findings.filter((row) => row.userId === userId && row.status !== "queued" && row.status !== "open").map((row) => row.semanticKey)),
  };
  const left = Math.max(0, pref.dailyInterruptBudget - interruptsUsed(pref, now));
  const judged = [];
  for (const row of db.findings.filter((item) => item.userId === userId && item.status === "queued")) {
    if (isHeldBack({ id: row.id, semanticKey: row.semanticKey, snoozeUntil: row.snoozeUntil ? Date.parse(row.snoozeUntil) : null }, sent, now.getTime())) continue;
    const agent = people.find((item) => item.id === row.agentId);
    const decision = judge({
      id: row.id,
      evidence: row.confidence,
      impact: row.impact,
      urgency: row.urgency,
      relevance: (weights.get(row.type) ?? 1) * (agent?.boost || 1),
      interruptionCost: COST,
      ignoredStreak: agent?.ignoredStreak ?? 0,
      muted: agent?.muted ?? false,
      interruptsLeft: left,
    });
    row.tier = decision.tier;
    row.score = decision.score;
    row.explanation = decision.explanation;
    row.status = decision.tier === "LOG" ? "logged" : "queued";
    if (decision.tier !== "LOG") judged.push({ ...decision, row });
  }
  const chosen = selectDelivery(judged, { mode: pref.mode, withinHours: hours, sessionStart, cap: pref.sessionCap, interruptsLeft: left });
  let interrupts = 0;
  for (const item of chosen) {
    const row = item.row;
    const agent = people.find((person) => person.id === row.agentId);
    const thread = db.threads.find((entry) => entry.userId === userId && entry.key === `direct:${agent?.slug}`);
    if (!agent || !thread) continue;
    if (row.activity) pushMessage(db, { threadId: thread.id, userId, agentId: agent.id, sender: "agent", type: "SYSTEM_STATUS", body: row.activity, signalId: row.id, replyTo: null, payload: null });
    if (row.intro && row.intro !== row.title && row.intro !== row.summary) {
      pushMessage(db, { threadId: thread.id, userId, agentId: agent.id, sender: "agent", type: "TEXT", body: row.intro, signalId: row.id, replyTo: null, payload: null });
    }
    pushMessage(db, {
      threadId: thread.id, userId, agentId: agent.id, sender: "agent", type: "SIGNAL_CARD", body: row.title, signalId: row.id, replyTo: null,
      payload: { title: row.title, summary: row.summary, hypothesis: row.hypothesis, proposedAction: row.proposedAction, confidence: row.confidence, confidenceLabel: confidenceLabel(row.confidence), evidence: row.evidence, explanation: row.explanation, status: "sent" },
    });
    row.status = "sent";
    row.tier = item.tier;
    if (item.tier === "INTERRUPT") interrupts += 1;
  }
  if (interrupts) {
    pref.interruptsToday = interruptsUsed(pref, now) + interrupts;
    pref.interruptsDay = localDay(now, pref.tzOffset);
  }
}

function ingest(db: DB, userId: string) {
  const people = agents(db, userId);
  for (const candidate of mockCandidates()) {
    const agent = people.find((item) => item.slug === candidate.agentSlug);
    if (!agent || db.findings.some((row) => row.userId === userId && row.semanticKey === candidate.semanticKey)) continue;
    db.findings.push({ id: newId("find"), userId, agentId: agent.id, type: candidate.type, semanticKey: candidate.semanticKey, title: candidate.title, summary: candidate.summary, hypothesis: candidate.hypothesis, proposedAction: candidate.proposedAction, intro: candidate.intro, activity: candidate.activity, confidence: candidate.confidence, impact: candidate.impact, urgency: candidate.urgency, evidence: candidate.evidence, status: "open", tier: "", score: 0, explanation: "", snoozeUntil: null });
  }
  const pref = db.prefs.find((row) => row.userId === userId)!;
  const weights = new Map(db.weights.filter((row) => row.userId === userId).map((row) => [row.type, row.weight]));
  const left = Math.max(0, pref.dailyInterruptBudget - interruptsUsed(pref, new Date()));
  for (const row of db.findings.filter((item) => item.userId === userId && item.status === "open")) {
    const agent = people.find((item) => item.id === row.agentId);
    const decision = judge({ id: row.id, evidence: row.confidence, impact: row.impact, urgency: row.urgency, relevance: (weights.get(row.type) ?? 1) * (agent?.boost || 1), interruptionCost: COST, ignoredStreak: agent?.ignoredStreak ?? 0, muted: Boolean(agent?.muted), interruptsLeft: left });
    row.tier = decision.tier;
    row.score = decision.score;
    row.explanation = decision.explanation;
    row.status = decision.tier === "LOG" ? "logged" : "queued";
  }
}

export async function noteWork(userId: string, kind: WorkKind, tzOffset?: number): Promise<void> {
  await withDb((db) => {
    ensure(db, userId);
    const pref = db.prefs.find((row) => row.userId === userId)!;
    if (typeof tzOffset === "number" && Number.isFinite(tzOffset)) pref.tzOffset = Math.trunc(tzOffset);
    const now = new Date();
    const hours = withinWorkingHours(now, pref.workStart, pref.workEnd, pref.tzOffset);
    const opening = shouldOpenSession({ kind, lastAt: pref.lastMeaningfulAt ? Date.parse(pref.lastMeaningfulAt) : null, now: now.getTime(), idleMs: pref.idleHours * 60 * 60 * 1000, withinHours: hours, mode: pref.mode });
    const inSession = pref.sessionOpenUntil ? Date.parse(pref.sessionOpenUntil) > now.getTime() : false;
    const meaningful = kind === "reply" || kind === "card" || kind === "edit";
    if (meaningful && (hours || pref.mode === "always")) {
      pref.lastMeaningfulAt = now.toISOString();
      pref.sessionOpenUntil = new Date(now.getTime() + pref.idleHours * 60 * 60 * 1000).toISOString();
    }
    if (opening) {
      ingest(db, userId);
      deliver(db, userId, true);
    } else if (inSession && meaningful) deliver(db, userId, false);
  });
}

async function compose(agent: InboxAgent, transcript: string): Promise<string[]> {
  try {
    const raw = await askForJson(
      [`You are ${agent.name}, texting a product manager.`, agent.instructions, agent.spec ? `Specifications: ${agent.spec}` : "", "Reply as 1 or 2 short texts, separated by a blank line. No emoji. No greeting. No claims that are not in the thread. If you do not know, say you will look."].filter(Boolean).join(" "),
      transcript.slice(0, 6000),
      false,
      undefined,
      "chat",
    );
    const parts = raw.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).slice(0, 2);
    if (parts.length) return parts.map((part) => part.slice(0, 400));
  } catch {
    // The user's text stays either way.
  }
  return ["I'll look. I'll text you if it's worth sending."];
}

export async function sendMessage(userId: string, threadId: string, body: string, replyTo?: string | null, tzOffset?: number): Promise<void> {
  const text = body.trim().slice(0, 2000);
  if (!text) throw new Error("Write a message first.");
  const prepared = await withDb((db) => {
    ensure(db, userId);
    const thread = db.threads.find((row) => row.id === threadId && row.userId === userId);
    if (!thread) throw new Error("Thread not found.");
    const people = db.members.filter((row) => row.threadId === threadId).flatMap((row) => {
      const agent = db.agents.find((item) => item.id === row.agentId);
      return agent ? [agent] : [];
    });
    pushMessage(db, { threadId, userId, agentId: null, sender: "user", type: "TEXT", body: text, signalId: null, replyTo: replyTo ?? null, payload: null });
    const history = db.messages.filter((row) => row.threadId === threadId && (row.type === "TEXT" || row.type === "SIGNAL_CARD")).slice(-12).map((row) => `${row.sender === "user" ? "You" : "Agent"}: ${row.body}`).join("\n");
    const card = replyTo ? db.messages.find((row) => row.id === replyTo) : undefined;
    const speaker = people[0];
    const runId = newId("run");
    const status = db.status.find((row) => row.userId === userId && row.agentId === speaker.id);
    if (status) Object.assign(status, { activity: "Writing", runId, updatedAt: new Date().toISOString() });
    else db.status.push({ userId, agentId: speaker.id, activity: "Writing", runId, updatedAt: new Date().toISOString() });
    return { thread, people, history: `${history}${card?.payload ? `\nCard: ${JSON.stringify(card.payload).slice(0, 1500)}` : ""}`, speaker };
  });
  const lines = await compose(prepared.speaker, prepared.history);
  let second: string[] = [];
  const fallback = lines.length === 1 && lines[0].startsWith("I'll look.");
  if (prepared.thread.kind === "pod" && prepared.people[1] && !fallback) second = await compose(prepared.people[1], `${prepared.history}\n${prepared.speaker.name}: ${lines.join(" ")}`);
  await withDb((db) => {
    for (const line of lines) pushMessage(db, { threadId, userId, agentId: prepared.speaker.id, sender: "agent", type: "TEXT", body: line, signalId: null, replyTo: replyTo ?? null, payload: null });
    if (!(second.length === 1 && second[0].startsWith("I'll look."))) {
      for (const line of second) pushMessage(db, { threadId, userId, agentId: prepared.people[1].id, sender: "agent", type: "TEXT", body: line, signalId: null, replyTo: null, payload: null });
    }
    for (const agent of prepared.people) {
      const status = db.status.find((row) => row.userId === userId && row.agentId === agent.id);
      if (status) Object.assign(status, { activity: "", runId: null, updatedAt: new Date().toISOString() });
    }
  });
  await noteWork(userId, "reply", tzOffset);
}

export async function actOnFinding(userId: string, findingId: string, action: "approve" | "snooze" | "dismiss" | "never", tzOffset?: number): Promise<void> {
  await withDb((db) => {
    ensure(db, userId);
    const finding = db.findings.find((row) => row.id === findingId && row.userId === userId);
    if (!finding) throw new Error("That note is gone.");
    const weight = db.weights.find((row) => row.userId === userId && row.type === finding.type);
    const agent = db.agents.find((row) => row.id === finding.agentId);
    let status = "dismissed";
    if (action === "snooze") {
      finding.status = "snoozed";
      finding.snoozeUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      status = "snoozed";
    } else if (action === "approve") {
      finding.status = "approved";
      if (weight) weight.weight = nextWeight(weight.weight, "approve");
      if (agent) agent.ignoredStreak = 0;
      status = "approved";
    } else {
      finding.status = "dismissed";
      if (weight) weight.weight = nextWeight(weight.weight, action === "never" ? "never" : "dismiss");
      if (agent) agent.ignoredStreak = action === "never" ? 6 : agent.ignoredStreak + 1;
    }
    for (const message of db.messages) {
      if (message.signalId === findingId && message.payload) message.payload = { ...message.payload, status };
    }
  });
  await noteWork(userId, "card", tzOffset);
}

export async function createAgent(userId: string, prompt: string): Promise<string> {
  const text = prompt.trim();
  if (!text) throw new Error("Describe the agent first.");
  let draft = { name: text.split(/[.\n]/)[0]?.trim().slice(0, 32) || "Agent", icon: (text[0] || "A").toUpperCase(), color: COLORS[0], instructions: text.slice(0, 400) };
  try {
    const raw = await askForJson("Return JSON with name, icon (one capital letter), color (hex), and instructions (one sentence).", text.slice(0, 500), false, undefined, "chat");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { name?: string; icon?: string; color?: string; instructions?: string };
      draft = {
        name: (parsed.name || draft.name).slice(0, 48),
        icon: markLetter(parsed.icon || draft.icon, parsed.name || draft.name),
        color: /^#[0-9a-fA-F]{6}$/.test(parsed.color ?? "") ? parsed.color! : draft.color,
        instructions: (parsed.instructions || draft.instructions).slice(0, 400),
      };
    }
  } catch {
    // The description itself is enough.
  }
  return withDb((db) => {
    ensure(db, userId);
    const slug = `custom-${newId("ag").slice(3, 10)}`;
    const id = newId("ag");
    const threadId = newId("th");
    db.agents.push({ id, userId, slug, name: draft.name, icon: draft.icon, color: draft.color, instructions: draft.instructions, spec: "", boost: 1, pinned: false, muted: false, ignoredStreak: 0, createdAt: new Date().toISOString() });
    db.threads.push({ id: threadId, userId, key: `direct:${slug}`, kind: "direct", title: draft.name, pinned: false, pinOrder: 0, updatedAt: new Date().toISOString() });
    db.members.push({ threadId, agentId: id });
    return threadId;
  });
}

export async function updateAgent(userId: string, agentId: string, patch: AgentPatch): Promise<void> {
  await withDb((db) => {
    ensure(db, userId);
    const agent = db.agents.find((row) => row.id === agentId && row.userId === userId);
    if (!agent) throw new Error("Agent not found.");
    if (patch.name) agent.name = patch.name.trim().slice(0, 48);
    if (patch.icon != null) agent.icon = markLetter(patch.icon, patch.name ?? agent.name);
    if (patch.color && /^#[0-9a-fA-F]{6}$/.test(patch.color)) agent.color = patch.color;
    if (patch.instructions != null) agent.instructions = patch.instructions.trim().slice(0, 600);
    if (patch.spec != null) agent.spec = patch.spec.trim().slice(0, 600);
    if (patch.boost != null && Number.isFinite(patch.boost)) agent.boost = Math.min(2, Math.max(0.25, patch.boost));
    if (patch.pinned != null) agent.pinned = patch.pinned;
    if (patch.muted != null) agent.muted = patch.muted;
    const thread = db.threads.find((row) => row.userId === userId && row.key === `direct:${agent.slug}`);
    if (thread) {
      thread.title = agent.name;
      thread.pinned = agent.pinned;
    }
  });
}

export async function createPod(userId: string, title: string, agentIds: string[]): Promise<string> {
  const name = title.trim().slice(0, 48);
  const ids = [...new Set(agentIds)].slice(0, 8);
  if (!name) throw new Error("Name the pod first.");
  if (ids.length < 2) throw new Error("A pod needs two agents.");
  return withDb((db) => {
    ensure(db, userId);
    const known = new Set(agents(db, userId).map((agent) => agent.id));
    if (ids.some((id) => !known.has(id))) throw new Error("Pick agents from this inbox.");
    const threadId = newId("pod");
    db.threads.push({ id: threadId, userId, key: `pod:${threadId}`, kind: "pod", title: name, pinned: false, pinOrder: 0, updatedAt: new Date().toISOString() });
    for (const agentId of ids) db.members.push({ threadId, agentId });
    return threadId;
  });
}

export async function readPrefs(userId: string): Promise<InboxPrefs> {
  return withDb((db) => {
    ensure(db, userId);
    const pref = db.prefs.find((row) => row.userId === userId)!;
    return {
      mode: pref.mode, workStart: pref.workStart, workEnd: pref.workEnd, tzOffset: pref.tzOffset, idleHours: pref.idleHours, sessionCap: pref.sessionCap, dailyInterruptBudget: pref.dailyInterruptBudget, slackInterrupts: pref.slackInterrupts, slackChannel: pref.slackChannel,
      weights: db.weights.filter((row) => row.userId === userId).map((row) => ({ type: row.type, weight: row.weight, autonomy: row.autonomy })),
      agents: agents(db, userId).map((agent) => ({ id: agent.id, name: agent.name, muted: agent.muted })),
    };
  });
}

export async function writePrefs(
  userId: string,
  patch: {
    mode?: NotifyMode;
    workStart?: number;
    workEnd?: number;
    idleHours?: number;
    sessionCap?: number;
    dailyInterruptBudget?: number;
    slackInterrupts?: boolean;
    slackChannel?: string;
    weights?: { type: string; autonomy?: string }[];
    muted?: { id: string; muted: boolean }[];
  },
): Promise<InboxPrefs> {
  await withDb((db) => {
    ensure(db, userId);
    const pref = db.prefs.find((row) => row.userId === userId)!;
    if (patch.mode) pref.mode = patch.mode;
    if (patch.workStart != null) pref.workStart = patch.workStart;
    if (patch.workEnd != null) pref.workEnd = patch.workEnd;
    if (patch.idleHours != null) pref.idleHours = patch.idleHours;
    if (patch.sessionCap != null) pref.sessionCap = patch.sessionCap;
    if (patch.dailyInterruptBudget != null) pref.dailyInterruptBudget = patch.dailyInterruptBudget;
    if (patch.slackInterrupts != null) pref.slackInterrupts = patch.slackInterrupts;
    if (patch.slackChannel != null) pref.slackChannel = patch.slackChannel;
    for (const weight of patch.weights ?? []) {
      const row = db.weights.find((item) => item.userId === userId && item.type === weight.type);
      if (row && weight.autonomy) row.autonomy = weight.autonomy;
    }
    for (const mute of patch.muted ?? []) {
      const agent = db.agents.find((row) => row.id === mute.id && row.userId === userId);
      if (agent) agent.muted = mute.muted;
    }
  });
  return readPrefs(userId);
}

export async function pinThread(userId: string, threadId: string, pinned: boolean): Promise<void> {
  await withDb((db) => {
    ensure(db, userId);
    const thread = db.threads.find((row) => row.id === threadId && row.userId === userId);
    if (!thread) throw new Error("Thread not found.");
    thread.pinned = pinned;
    if (pinned) thread.pinOrder = nextPinOrder(db, userId);
    if (thread.kind === "direct") {
      const member = db.members.find((row) => row.threadId === threadId);
      const agent = member && db.agents.find((row) => row.id === member.agentId);
      if (agent) agent.pinned = pinned;
    }
  });
}

function nextPinOrder(db: DB, userId: string): number {
  const orders = db.threads.filter((row) => row.userId === userId && row.pinned).map((row) => row.pinOrder ?? 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export async function reorderPins(userId: string, ids: string[]): Promise<void> {
  await withDb((db) => {
    ensure(db, userId);
    ids.forEach((id, index) => {
      const thread = db.threads.find((row) => row.id === id && row.userId === userId);
      if (thread) thread.pinOrder = index;
    });
  });
}

export async function deleteThread(userId: string, threadId: string): Promise<void> {
  await withDb((db) => {
    ensure(db, userId);
    const thread = db.threads.find((row) => row.id === threadId && row.userId === userId);
    if (!thread) throw new Error("Thread not found.");
    if (thread.kind === "direct") {
      const member = db.members.find((row) => row.threadId === threadId);
      const agent = member && db.agents.find((row) => row.id === member.agentId);
      if (agent) {
        db.removed.push({ userId, slug: agent.slug });
        db.agents = db.agents.filter((row) => row.id !== agent.id);
        db.findings = db.findings.filter((row) => row.agentId !== agent.id);
        db.status = db.status.filter((row) => row.agentId !== agent.id);
      }
    }
    db.threads = db.threads.filter((row) => row.id !== threadId);
    db.members = db.members.filter((row) => row.threadId !== threadId);
    db.messages = db.messages.filter((row) => row.threadId !== threadId);
  });
}
