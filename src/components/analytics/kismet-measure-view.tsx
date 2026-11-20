"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MeasureChart, MeasureExperimentResponse, MeasureOverviewResponse, MeasurePoint } from "@/lib/autopilot/measure-types";
import { GoalEditor } from "@/components/autopilot/goal-editor";

async function loadMeasure<T>(experimentId?: string): Promise<T> {
  const url = experimentId ? `/api/autopilot/measure?experiment=${encodeURIComponent(experimentId)}` : "/api/autopilot/measure";
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Kismet could not load measurement.");
  return body;
}

export function KismetMeasureView({ experimentId }: { experimentId: string | null }) {
  const query = useQuery<MeasureExperimentResponse | MeasureOverviewResponse>({
    queryKey: ["kismet-measure", experimentId],
    queryFn: () => experimentId ? loadMeasure<MeasureExperimentResponse>(experimentId) : loadMeasure<MeasureOverviewResponse>(),
    staleTime: 30_000,
  });
  if (query.isPending) return <div className="p-6 text-sm text-[#6b7280]">Loading measurement…</div>;
  if (query.error) return <div className="p-6 text-sm text-red-700">{query.error.message}</div>;
  return experimentId
    ? <ExperimentMeasure data={query.data as MeasureExperimentResponse} />
    : <MeasureOverview data={query.data as MeasureOverviewResponse} onGoalsChanged={() => query.refetch()} />;
}

function MeasureOverview({ data, onGoalsChanged }: { data: MeasureOverviewResponse; onGoalsChanged: () => Promise<unknown> }) {
  const [editingGoals, setEditingGoals] = useState(false);
  return (
    <main className="min-h-0 flex-1 overflow-auto bg-white p-6 text-[#111827]">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-lg font-semibold">Kismet</h2>
        <p className="mt-1 text-sm text-[#6b7280]">Measure whether changes improve the outcomes that matter.</p>
        <section className="mt-7">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Goals</h3>
            <button type="button" className="text-xs text-brand hover:underline" onClick={() => setEditingGoals((value) => !value)}>Edit goals</button>
          </div>
          {editingGoals ? <GoalEditor onChanged={onGoalsChanged} /> : null}
          {data.goals.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7280]">No goals yet — Kismet proposes them once it has seen enough visitors.</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {data.goals.map((goal) => (
                <div key={goal.id} className="rounded-lg border border-[#e6e8ec] p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{goal.name}</p>
                    <p className="font-mono text-sm">{formatRate(goal.currentRate)}</p>
                  </div>
                  <div className="mt-3 h-20"><MiniChart data={goal.series} /></div>
                  <p className="mt-1 text-xs text-[#9aa0a8]">Last 30 days</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mt-8">
          <h3 className="text-sm font-medium">Running now</h3>
          {data.running.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7280]">Nothing is being measured right now.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#e6e8ec] rounded-lg border border-[#e6e8ec]">
              {data.running.map((item) => (
                <a key={item.id} href={`/analytics?experiment=${encodeURIComponent(item.id)}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#f8fafc]">
                  <span><span className="block text-sm font-medium">{item.title}</span><span className="mt-0.5 block text-xs capitalize text-[#6b7280]">{item.kind} · {item.status.replaceAll("_", " ")}</span></span>
                  <span className="text-xs text-brand">{item.headline} →</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ExperimentMeasure({ data }: { data: MeasureExperimentResponse }) {
  return (
    <main className="min-h-0 flex-1 overflow-auto bg-white p-6 text-[#111827]">
      <div className="mx-auto max-w-5xl">
        {/* One way back (to all results) and one way across (to the experiment), never two back links. */}
        <div className="flex items-center justify-between gap-4 text-xs">
          <a href="/analytics" className="text-brand hover:underline">‹ All results</a>
          <a href={`/experiments?experiment=${encodeURIComponent(data.experiment.id)}`} className="text-brand hover:underline">Open in Dashboard →</a>
        </div>
        <h2 className="mt-4 text-xl font-semibold">{data.experiment.title}</h2>
        <p className="mt-2 text-sm text-[#6b7280]">Share of visitors who {data.experiment.metric.replace(/^visitors who\s+/i, "")}.</p>
        <MeasureSection title="Metric" chart={data.metric} />
        {data.guardrail && <MeasureSection title={`Guardrail · ${data.experiment.guardrail}`} chart={data.guardrail} />}
      </div>
    </main>
  );
}

function MeasureSection({ title, chart }: { title: string; chart: MeasureChart }) {
  const names = chart.mode === "arms" ? ["control", "treatment"] : ["before", "after"];
  return (
    <section className="mt-7">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-3 h-72 rounded-lg border border-[#e6e8ec] p-3">
        {chart.series.every((point) => names.every((name) => point[name] == null)) ? (
          <p className="flex h-full items-center justify-center text-sm text-[#6b7280]">No daily data to chart for this yet.</p>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.series}>
            <CartesianGrid stroke="#e6e8ec" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} width={42} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => formatRate(typeof value === "number" ? value : null)} labelFormatter={(value) => String(value)} />
            {chart.changeAt && <ReferenceLine x={chart.changeAt.slice(0, 10)} stroke="#6b7280" strokeDasharray="4 4" label={{ value: "Change", fontSize: 11, fill: "#6b7280" }} />}
            {names.map((name, index) => <Line key={name} type="linear" dataKey={name} name={label(name)} stroke={index ? "#2563eb" : "#6b7280"} strokeWidth={2} dot={false} connectNulls={false} />)}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {names.map((name) => {
          const total = chart.totals[name];
          return <div key={name} className="rounded border border-[#e6e8ec] px-3 py-2"><p className="text-xs text-[#6b7280]">{label(name)}</p><p className="mt-1 text-lg font-medium">{formatRate(total?.rate ?? null)}</p><p className="text-xs text-[#6b7280]">{total?.conversions ?? 0} conversions · {total?.visitors ?? 0} visitors</p></div>;
        })}
      </div>
    </section>
  );
}

function MiniChart({ data }: { data: MeasurePoint[] }) {
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><Line type="linear" dataKey="rate" stroke="#2563eb" strokeWidth={1.5} dot={false} connectNulls /><YAxis hide domain={[0, "auto"]} /><XAxis hide dataKey="day" /></LineChart></ResponsiveContainer>;
}

function formatRate(value: number | null): string { return value == null ? "—" : `${(value * 100).toFixed(1)}%`; }
function label(value: string): string { return value === "treatment" ? "New version" : value[0].toUpperCase() + value.slice(1); }
