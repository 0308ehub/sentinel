"use client";

import { useEffect, useState } from "react";
import { activitySummary, formatCountdown, formatDollars, nextDailyReset, spendTotal, type ActivityCount, type SpendAmounts } from "@/lib/autopilot/spend-core";

interface SpendDay extends SpendAmounts {
  day: string;
  sessions: number;
  activity: ActivityCount[];
}

interface Totals extends SpendAmounts { totalCents: number }

interface Overview {
  today: { cents: number; limitCents: number; paused: boolean };
  days: SpendDay[];
  totals: { last7Days: Totals; thisMonth: Totals };
  recent: { title: string; kind: "build" | "render" | "chat"; cents: number; experimentId: string | null; createdAt: string }[];
}

const COLORS = { build: "#2563eb", render: "#60a5fa", model: "#9ca3af", chat: "#374151" } as const;

export function SpendOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/autopilot/spend", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as Overview & { error?: string };
        if (!response.ok) throw new Error(body.error || "Kismet could not load spending.");
        if (active) setData(body);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Kismet could not load spending."));
    return () => { active = false; };
  }, []);

  if (error) return <p className="py-8 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-8 text-sm text-[#6b7280]">Loading spend overview…</p>;

  const hasSpend = data.days.some((day) => spendTotal(day) > 0);
  const hasActivity = data.days.some((day) => activitySummary(day.activity).length > 0);
  if (!hasSpend && !hasActivity && data.recent.length === 0) {
    return <div className="space-y-6 py-2"><TodayMeter today={data.today} /><p className="py-6 text-sm text-[#6b7280]">Kismet has not recorded any costs or activity yet.</p></div>;
  }
  const max = Math.max(1, ...data.days.map(spendTotal));
  const activityDays = [...data.days].reverse().filter((day) => activitySummary(day.activity).length > 0);

  return (
    <div className="space-y-8 py-2 text-sm text-[#374151]">
      <TodayMeter today={data.today} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TotalCard title="Last 7 days" total={data.totals.last7Days} />
        <TotalCard title="This month" total={data.totals.thisMonth} />
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-[#111827]">Daily spend</h2>
          <div className="flex flex-wrap gap-4 text-xs text-[#6b7280]">
            <Legend color={COLORS.build} label="Coding agent" /><Legend color={COLORS.render} label="Preview renders" />
            <Legend color={COLORS.model} label="Model calls (estimated)" /><Legend color={COLORS.chat} label="Code mode" />
          </div>
        </div>
        <div className="mt-4 flex h-44 items-end gap-1 border-b border-[#e6e8ec] px-1" aria-label="Thirty day stacked spend chart">
          {data.days.map((day) => {
            const total = spendTotal(day);
            const title = `${dayLabel(day.day)} · Coding agent ${formatDollars(day.buildCents)} · Preview renders ${formatDollars(day.renderCents)} · Model calls ${formatDollars(day.modelCents)} · Code mode ${formatDollars(day.chatCents)}`;
            return (
              <div key={day.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={title}>
                <div className="flex min-h-px w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(total / max) * 100}%` }}>
                  <Bar cents={day.buildCents} total={total} color={COLORS.build} />
                  <Bar cents={day.renderCents} total={total} color={COLORS.render} />
                  <Bar cents={day.modelCents} total={total} color={COLORS.model} />
                  <Bar cents={day.chatCents} total={total} color={COLORS.chat} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[#9aa0a8]"><span>{dayLabel(data.days[0]?.day)}</span><span>Today</span></div>
      </section>

      <section>
        <h2 className="font-medium text-[#111827]">What Kismet did</h2>
        {activityDays.length === 0 ? <p className="mt-2 text-[#6b7280]">No activity was recorded in this period.</p> : (
          <ul className="mt-2 divide-y divide-[#eef0f3]">
            {activityDays.map((day) => <li key={day.day} className="py-2.5"><span className="font-medium text-[#111827]">{dayLabel(day.day)}</span><span className="text-[#6b7280]"> · {activitySummary(day.activity).join(" · ")}</span></li>)}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium text-[#111827]">Recent agent sessions</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead><tr className="border-b border-[#e6e8ec] text-xs text-[#6b7280]"><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Title</th><th className="py-2 font-medium">Kind</th><th className="py-2 text-right font-medium">Cost</th></tr></thead>
          <tbody>{data.recent.length === 0 ? <tr><td colSpan={4} className="py-5 text-[#6b7280]">No agent sessions were recorded in this period.</td></tr> : data.recent.map((session, index) => (
            <tr key={`${session.createdAt}-${index}`} className="border-b border-[#eef0f3]">
              <td className="whitespace-nowrap py-3 text-xs">{dayLabel(session.createdAt.slice(0, 10))}</td>
              <td>{session.experimentId ? <a className="font-medium text-brand hover:underline" href={`?experiment=${encodeURIComponent(session.experimentId)}`}>{session.title}</a> : session.title}</td>
              <td>{kindLabel(session.kind)}</td><td className="text-right tabular-nums">{formatDollars(session.cents)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}

function TodayMeter({ today }: { today: Overview["today"] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const reset = nextDailyReset(now);
  const localTime = reset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const utcTime = reset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
  return <div>
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-[#374151]">Today {formatDollars(today.cents)} of {formatDollars(today.limitCents)}</span>
      {today.paused && <span className="font-medium text-orange-600">Paused until tomorrow</span>}
    </div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef0f3]">
      <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, today.limitCents ? (today.cents / today.limitCents) * 100 : 100)}%` }} />
    </div>
    <p className="mt-1.5 text-xs text-[#6b7280]" title={utcTime}>Resets daily at {localTime} (in {formatCountdown(reset.getTime() - now.getTime())})</p>
  </div>;
}

function TotalCard({ title, total }: { title: string; total: Totals }) {
  return <div className="rounded-md border border-[#e1e4e8] p-4"><p className="text-xs text-[#6b7280]">{title}</p><p className="mt-1 text-2xl font-medium text-[#111827]">{formatDollars(total.totalCents)}</p><p className="mt-2 text-xs leading-5 text-[#6b7280]">Coding agent {formatDollars(total.buildCents)} · Preview renders {formatDollars(total.renderCents)} · Model calls (estimated) {formatDollars(total.modelCents)} · Code mode {formatDollars(total.chatCents)}</p></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}</span>;
}

function Bar({ cents, total, color }: { cents: number; total: number; color: string }) {
  return cents > 0 ? <span style={{ height: `${(cents / total) * 100}%`, backgroundColor: color }} /> : null;
}

function dayLabel(day: string | undefined): string {
  if (!day) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

function kindLabel(kind: "build" | "render" | "chat"): string {
  return kind === "build" ? "Coding agent" : kind === "render" ? "Preview render" : "Code mode";
}
