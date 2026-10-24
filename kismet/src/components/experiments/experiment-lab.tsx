"use client";

import { useEffect, useState } from "react";
import type { SegmentFilter } from "@/lib/analytics/explore-types";
import { ExperimentMonitor } from "@/components/experiments/experiment-monitor";
import {
  ROLLOUTS,
  nextArmId,
  parseAllocation,
  shares,
  type AllocationArm,
  type ExperimentAllocation,
  type ExperimentMetric,
  type ExpectedChange,
  type ExperimentReadout,
} from "@/lib/experiments/allocation";
import { interpret } from "@/lib/experiments/stats";
import { graphStore } from "@/lib/graph/graph-store";
import { useAnalyticsLibrary } from "@/stores/analytics-store";
import type { GraphNode, NodeStatus } from "@/types/graph";

const COLORS: Record<string, string> = {
  a: "#0571d3",
  b: "#2f8f6b",
  c: "#c47b2b",
  control: "#d4d4d4",
};

export function ExperimentLab({ node }: { node: GraphNode }) {
  const segments = useAnalyticsLibrary((state) => state.segments);
  const [plan, setPlan] = useState<ExperimentAllocation>(() =>
    parseAllocation(node.metadata.allocation, text(node.metadata.treatment), text(node.metadata.control))
  );
  const [readout, setReadout] = useState<ExperimentReadout | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const control = label(text(node.metadata.control), "Control");

  useEffect(() => {
    setPlan(parseAllocation(node.metadata.allocation, text(node.metadata.treatment), text(node.metadata.control)));
    // Opening a different experiment reloads its saved allocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch("/api/experiments/readout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, control }),
      })
        .then(async (res) => {
          const body = (await res.json()) as ExperimentReadout & { hint?: string; error?: string };
          if (cancelled) return;
          if (!res.ok || !body.state) {
            setReadout(null);
            setError(body.hint || body.error || "Could not read the warehouse.");
            return;
          }
          setError("");
          setReadout(body);
        })
        .catch(() => {
          if (!cancelled) setError("Could not read the warehouse.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [plan.rollout, plan.metric, plan.arms, plan.cohorts, control, node.id]);

  useEffect(() => {
    if (!readout) return;
    const baseline = readout.arms.find((arm) => arm.id === "control");
    const call = interpret({
      metric: plan.metric,
      direction: plan.direction,
      state: readout.state,
      summary: readout.summary,
      needed: readout.needed,
      controlUsers: baseline?.users ?? 0,
      arms: readout.arms.filter((arm) => arm.id !== "control"),
    });
    graphStore.getState().noteExperimentReadout(node.id, call);
  }, [readout, plan.metric, plan.direction, node.id]);

  function update(next: ExperimentAllocation) {
    const keyed: ExperimentAllocation = {
      ...next,
      arms: next.arms.map((arm, index) => ({ ...arm, id: (["a", "b", "c"] as const)[index] ?? arm.id })),
    };
    setPlan(keyed);
    graphStore.getState().saveExperimentPlan(node.id, keyed);
  }

  const split = shares(plan.rollout, plan.arms);
  const rows = [
    ...plan.arms.map((arm) => ({ ...arm, percent: percentOf(split, arm.id) })),
    { id: "control", name: control, weight: null as number | null, percent: percentOf(split, "control") },
  ];
  const audience = readout?.audience ?? null;

  return (
    <div className="mt-10 space-y-8">
      <section>
        <h2 className="text-sm font-medium">Allocation</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_200px]">
            <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
              <h3 className="text-sm font-medium">Audience</h3>
              <ol className="mt-4 space-y-4">
                {plan.cohorts.map((cohort, index) => (
                  <li key={`${cohort.id}-${index}`} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <select
                        aria-label={`Audience ${index + 1}`}
                        value={cohort.id}
                        onChange={(event) => changeCohort(event.target.value, index)}
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      >
                        <option value={cohort.id}>{cohort.name}</option>
                        {cohort.id !== "all" && <option value="all">All customers</option>}
                        {segments
                          .filter((segment) => segment.id !== cohort.id)
                          .map((segment) => (
                            <option key={segment.id} value={segment.id}>
                              {segment.name}
                            </option>
                          ))}
                      </select>
                      <p className="mt-1 text-[11px] text-muted-foreground">where Cohort = {cohort.name}</p>
                      {index > 0 && (
                        <button type="button" className="mt-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => removeCohort(index)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {plan.cohorts.length < 3 && segments.length > 0 && (
                <button
                  type="button"
                  className="mt-4 text-xs text-brand hover:underline"
                  onClick={() => {
                    const segment = segments.find((item) => !plan.cohorts.some((cohort) => cohort.id === item.id));
                    if (!segment) return;
                    update({
                      ...plan,
                      cohorts: [...plan.cohorts, { id: segment.id, name: segment.name, filter: segment.filter }],
                    });
                  }}
                >
                  Add audience
                </button>
              )}
            </div>

            <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
              <p className="text-xs text-muted-foreground">Customers in this window</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">{audience == null ? "…" : audience.toLocaleString("en-US")}</p>
              <p className="text-[11px] text-muted-foreground">{windowLabel(readout)}</p>
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

              <p className="mt-5 text-xs text-muted-foreground">Rollout</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ROLLOUTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ ...plan, rollout: value })}
                    className={`h-7 min-w-9 rounded-md px-2 text-xs tabular-nums ${
                      plan.rollout === value ? "bg-foreground text-background" : "border border-border"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <span className="flex h-7 items-center px-1 text-xs text-muted-foreground">{plan.rollout}%</span>
              </div>

              <table className="mt-5 w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 font-normal">Variant</th>
                    <th className="py-1 font-normal">Weight</th>
                    <th className="py-1 font-normal">Share</th>
                    <th className="py-1 text-right font-normal">Customers</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[row.id] ?? COLORS.control }} />
                        {row.id === "control" ? (
                          row.name
                        ) : (
                          <input
                            aria-label={`${row.name} name`}
                            value={row.name}
                            onChange={(event) => renameArm(row.id, event.target.value)}
                            className="w-28 bg-transparent outline-none"
                          />
                        )}
                        {row.id !== "control" && plan.arms.length > 1 && (
                          <button type="button" className="ml-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => removeArm(row.id)}>
                            Remove
                          </button>
                        )}
                      </td>
                      <td className="py-2">
                        {row.weight == null ? (
                          "—"
                        ) : (
                          <input
                            aria-label={`${row.name} weight`}
                            type="number"
                            min={1}
                            max={20}
                            value={row.weight}
                            onChange={(event) => reweight(row.id, Number(event.target.value))}
                            className="h-7 w-14 rounded-md border border-border bg-background px-2 font-mono tabular-nums"
                          />
                        )}
                      </td>
                      <td className="py-2 tabular-nums">{row.percent}%</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {audience == null ? "…" : Math.round((audience * row.percent) / 100).toLocaleString("en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.arms.length < 3 && (
                <button type="button" className="mt-2 text-xs text-brand hover:underline" onClick={addArm}>
                  Add variant
                </button>
              )}
            </div>

            <div className="p-4">
              <p className="text-xs text-muted-foreground">Split</p>
              <div className="mt-3 flex h-52 gap-3">
                <div className="flex w-14 flex-col overflow-hidden rounded-md">
                  {rows
                    .filter((row) => row.percent > 0)
                    .map((row) => (
                      <div key={row.id} style={{ height: `${row.percent}%`, background: COLORS[row.id] ?? COLORS.control }} />
                    ))}
                </div>
                <ul className="flex flex-1 flex-col justify-center gap-3">
                  {rows.map((row) => (
                    <li key={row.id} className="text-xs">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[row.id] ?? COLORS.control }} />
                      {row.name}
                      <span className="mt-0.5 block pl-3.5 font-mono tabular-nums text-muted-foreground">{row.percent}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ExperimentMonitor
        plan={plan}
        readout={readout}
        loading={loading}
        status={node.status}
        onMetric={(metric: ExperimentMetric) => update({ ...plan, metric })}
        onDirection={(direction: ExpectedChange) => update({ ...plan, direction })}
        onResolve={() => graphStore.getState().moveWork(node.id, "COMPLETED" as NodeStatus)}
      />
    </div>
  );

  function changeCohort(value: string, index: number) {
    const next = plan.cohorts.slice();
    if (value === "all") next[index] = { id: "all", name: "All customers", filter: emptyFilter() };
    else {
      const segment = segments.find((item) => item.id === value);
      if (!segment) return;
      next[index] = { id: segment.id, name: segment.name, filter: segment.filter };
    }
    update({ ...plan, cohorts: next });
  }

  function removeCohort(index: number) {
    update({ ...plan, cohorts: plan.cohorts.filter((_, item) => item !== index) });
  }

  function renameArm(id: string, name: string) {
    update({ ...plan, arms: plan.arms.map((arm) => (arm.id === id ? { ...arm, name: name.slice(0, 40) } : arm)) });
  }

  function reweight(id: string, weight: number) {
    const next = Math.min(20, Math.max(1, Math.floor(weight) || 1));
    update({ ...plan, arms: plan.arms.map((arm) => (arm.id === id ? { ...arm, weight: next } : arm)) });
  }

  function removeArm(id: string) {
    update({ ...plan, arms: plan.arms.filter((arm) => arm.id !== id) });
  }

  function addArm() {
    const id = nextArmId(plan.arms);
    if (!id) return;
    const arm: AllocationArm = { id, name: `Variant ${plan.arms.length + 1}`, weight: 1 };
    update({ ...plan, arms: [...plan.arms, arm] });
  }
}

function emptyFilter(): SegmentFilter {
  return { product: null, payment: null, minOrders: 1, customerId: null, city: null, state: null };
}

function percentOf(split: { id: string; percent: number }[], id: string): number {
  return split.find((item) => item.id === id)?.percent ?? 0;
}

function windowLabel(readout: ExperimentReadout | null): string {
  if (!readout?.startDay || !readout.endDay) return "Warehouse orders";
  const start = new Date(`${readout.startDay}T00:00:00`);
  const end = new Date(`${readout.endDay}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startText} – ${endText}`;
}

function label(value: string, fallback: string): string {
  return value && value.length <= 40 ? value : fallback;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
