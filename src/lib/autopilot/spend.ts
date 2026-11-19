import "server-only";

import { db } from "@/lib/autopilot/db";
import { autopilotUser } from "@/lib/autopilot/scope";
import { accountDailyLimitCents, activityLabel, combineTodaySpend, spendTotal, utcDays, type ActivityCount, type SpendAmounts } from "@/lib/autopilot/spend-core";
import { client } from "@/lib/coder/sessions";

export type AgentSpendKind = "build" | "render" | "chat";

export interface SpendDay extends SpendAmounts {
  day: string;
  sessions: number;
  activity: ActivityCount[];
}

export interface RecentAgentSpend {
  title: string;
  kind: AgentSpendKind;
  cents: number;
  experimentId: string | null;
  createdAt: string;
}

export interface SpendOverview {
  today: { cents: number; limitCents: number; paused: boolean };
  days: SpendDay[];
  totals: { last7Days: SpendAmounts & { totalCents: number }; thisMonth: SpendAmounts & { totalCents: number } };
  recent: RecentAgentSpend[];
}

export class AgentBudgetError extends Error {}

export async function todaySpendCents(userId: string): Promise<number> {
  const sql = await db();
  const day = new Date().toISOString().slice(0, 10);
  const [modelRows, agentRows] = await Promise.all([
    sql<{ cents: number }[]>`
      select coalesce(cents, 0)::int as cents from kismet.ai_spend
      where subject = ${`user:${userId}`} and bucket = ${`day:${day}`} limit 1
    `,
    sql<{ cents: number; settled: boolean }[]>`
      select cents::int, settled from kismet.agent_spend
      where user_id = ${userId}
        and created_at >= ${day}::date at time zone 'UTC'
        and created_at < (${day}::date + 1) at time zone 'UTC'
    `,
  ]);
  return combineTodaySpend(Number(modelRows[0]?.cents ?? 0), agentRows.map((row) => ({
    cents: Number(row.cents), settled: Boolean(row.settled),
  })));
}

export async function agentBudgetLeft(userId = autopilotUser()): Promise<number> {
  return Math.max(0, accountDailyLimitCents() - await todaySpendCents(userId));
}

export async function assertAgentBudget(userId = autopilotUser()): Promise<void> {
  if (await agentBudgetLeft(userId) <= 0) throw new AgentBudgetError("This account reached its daily spending limit. It resets tomorrow.");
}

export async function recordAgentSession(input: {
  sessionId: string;
  userId: string;
  kind: AgentSpendKind;
  experimentId?: string | null;
  title: string;
}): Promise<void> {
  const sql = await db();
  await sql`
    insert into kismet.agent_spend (session_id, user_id, kind, experiment_id, title)
    values (${input.sessionId}, ${input.userId}, ${input.kind}, ${input.experimentId ?? null}, ${input.title})
    on conflict (session_id) do nothing
  `;
}

type UnsettledRow = { session_id: string; created_at: Date | string };

export async function refreshAgentSpend(): Promise<string | null> {
  const sql = await db();
  const userId = autopilotUser();
  const rows = await sql<UnsettledRow[]>`
    select session_id, created_at from kismet.agent_spend
    where user_id = ${userId} and settled = false and created_at >= now() - interval '7 days'
    order by created_at asc limit 20
  `;
  for (const row of rows) {
    try {
      const session = await client().beta.sessions.retrieve(row.session_id);
      const raw = Number(session.usage?.list_cost?.amount ?? 0);
      const cents = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      const oldEnough = Date.now() - new Date(row.created_at).getTime() >= 2 * 60 * 60 * 1000;
      const settled = session.status === "terminated" || (session.status === "idle" && oldEnough);
      await sql`
        update kismet.agent_spend set cents = ${cents}, settled = ${settled}, updated_at = now()
        where session_id = ${row.session_id} and user_id = ${userId}
      `;
    } catch {
      // A session can be temporarily unavailable; retry it on a later tick.
    }
  }
  // Cost refreshes are bookkeeping; keep them out of the tick's step messages.
  return null;
}

type AgentDayRow = { day: string; kind: AgentSpendKind; cents: number; sessions: number };
type ModelDayRow = { day: string; cents: number };
type ActivityDayRow = { day: string; kind: string; count: number };
type RecentRow = { title: string; kind: AgentSpendKind; cents: number; experiment_id: string | null; created_at: Date | string };

const emptyAmounts = (): SpendAmounts => ({ buildCents: 0, renderCents: 0, modelCents: 0, chatCents: 0 });

export async function spendOverview(days = 30): Promise<SpendOverview> {
  const sql = await db();
  const userId = autopilotUser();
  const dayKeys = utcDays(days);
  const firstDay = dayKeys[0] ?? new Date().toISOString().slice(0, 10);
  const subject = `user:${userId}`;
  const [agentRows, modelRows, activityRows, recent, todayCents] = await Promise.all([
    sql<AgentDayRow[]>`
      select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, kind,
        coalesce(sum(cents), 0)::int as cents, count(*)::int as sessions
      from kismet.agent_spend
      where user_id = ${userId}
        and created_at >= least(${firstDay}::date, date_trunc('month', now() at time zone 'UTC')::date, (now() at time zone 'UTC')::date - 6)
      group by 1, 2 order by 1
    `,
    sql<ModelDayRow[]>`
      select substring(bucket from 5) as day, cents::int
      from kismet.ai_spend
      where subject = ${subject} and bucket like 'day:%'
        and substring(bucket from 5)::date >= least(${firstDay}::date, date_trunc('month', now() at time zone 'UTC')::date, (now() at time zone 'UTC')::date - 6)
    `,
    sql<ActivityDayRow[]>`
      select to_char(at at time zone 'UTC', 'YYYY-MM-DD') as day, kind, count(*)::int as count
      from kismet.activity where user_id = ${userId} and at >= ${firstDay}::date
      group by 1, 2 order by 1 desc, 2
    `,
    sql<RecentRow[]>`
      select title, kind, cents, experiment_id, created_at
      from kismet.agent_spend where user_id = ${userId}
      order by created_at desc limit 20
    `,
    todaySpendCents(userId),
  ]);

  const byDay = new Map<string, SpendDay>();
  const getDay = (day: string) => {
    const found = byDay.get(day);
    if (found) return found;
    const created: SpendDay = { day, ...emptyAmounts(), sessions: 0, activity: [] };
    byDay.set(day, created);
    return created;
  };
  for (const row of agentRows) {
    const day = getDay(row.day);
    if (row.kind === "build") day.buildCents += row.cents;
    else if (row.kind === "render") day.renderCents += row.cents;
    else day.chatCents += row.cents;
    day.sessions += row.sessions;
  }
  for (const row of modelRows) getDay(row.day).modelCents += row.cents;
  for (const row of activityRows) getDay(row.day).activity.push({ kind: row.kind, count: row.count });

  const now = new Date();
  const last7Start = utcDays(7, now)[0];
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const totalFor = (start: string) => {
    const amounts = emptyAmounts();
    for (const [day, row] of byDay) {
      if (day < start) continue;
      amounts.buildCents += row.buildCents;
      amounts.renderCents += row.renderCents;
      amounts.modelCents += row.modelCents;
      amounts.chatCents += row.chatCents;
    }
    return { ...amounts, totalCents: spendTotal(amounts) };
  };

  return {
    today: { cents: todayCents, limitCents: accountDailyLimitCents(), paused: todayCents >= accountDailyLimitCents() },
    days: dayKeys.map((day) => getDay(day)),
    totals: { last7Days: totalFor(last7Start), thisMonth: totalFor(monthStart) },
    recent: recent.map((row) => ({
      title: row.title,
      kind: row.kind,
      cents: row.cents,
      experimentId: row.experiment_id,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

export { activityLabel };
