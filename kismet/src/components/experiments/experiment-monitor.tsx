"use client";

import { interpret } from "@/lib/experiments/stats";
import {
  METRIC_LABEL,
  metricValue,
  type ExpectedChange,
  type ExperimentAllocation,
  type ExperimentMetric,
  type ExperimentReadout,
} from "@/lib/experiments/allocation";
import type { NodeStatus } from "@/types/graph";

const COLORS: Record<string, string> = {
  control: "#0571d3",
  a: "#2f8f6b",
  b: "#e07a3d",
  c: "#c47b2b",
};

const DIRECTIONS: { id: ExpectedChange; label: string }[] = [
  { id: "increase", label: "Increase" },
  { id: "decrease", label: "Decrease" },
  { id: "any", label: "Any" },
];

export function ExperimentMonitor({
  plan,
  readout,
  loading,
  status,
  onMetric,
  onDirection,
  onResolve,
}: {
  plan: ExperimentAllocation;
  readout: ExperimentReadout | null;
  loading: boolean;
  status: NodeStatus;
  onMetric: (metric: ExperimentMetric) => void;
  onDirection: (direction: ExpectedChange) => void;
  onResolve: () => void;
}) {
  const control = readout?.arms.find((arm) => arm.id === "control");
  const call = readout
    ? interpret({
        metric: plan.metric,
        direction: plan.direction,
        state: readout.state,
        summary: readout.summary,
        needed: readout.needed,
        controlUsers: control?.users ?? 0,
        arms: readout.arms.filter((arm) => arm.id !== "control"),
      })
    : null;
  const conclusive = call?.state === "significant" || call?.state === "no_difference";

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Monitoring</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Expected change">
            {DIRECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onDirection(item.id)}
                className={`h-7 rounded px-2 ${plan.direction === item.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Primary metric"
            value={plan.metric}
            onChange={(event) => onMetric(event.target.value as ExperimentMetric)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            {(Object.keys(METRIC_LABEL) as ExperimentMetric[]).map((metric) => (
              <option key={metric} value={metric}>
                {METRIC_LABEL[metric]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border p-4">
        <div className={`rounded-lg border px-3 py-2 text-sm ${call?.state === "significant" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-border"}`}>
          {call?.summary || "Reading customers from the warehouse."}
          {loading ? <span className="ml-2 text-[11px] text-muted-foreground">Updating</span> : null}
        </div>

        {readout && control && (
          <>
            <p className="mt-5 text-xs text-muted-foreground">{METRIC_LABEL[plan.metric]}</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              {readout.arms.map((arm) => {
                const won = call?.state === "significant" && arm.id !== "control" && arm.pValue != null && arm.pValue < (plan.direction === "any" ? 0.05 : 0.1);
                return (
                  <div key={arm.id}>
                    <p className="text-xs text-muted-foreground">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[arm.id] ?? COLORS.control }} />
                      {arm.name}
                      {arm.id === "control" ? " · baseline" : won ? " · significant" : ""}
                    </p>
                    <p className="mt-1 font-mono text-2xl tabular-nums">{formatMetric(metricValue(arm, plan.metric), plan.metric)}</p>
                    <p className={`text-xs ${won && (arm.lift ?? 0) >= 0 ? "text-emerald-700" : won ? "text-red-600" : "text-muted-foreground"}`}>
                      {arm.id === "control" ? since(readout) : liftText(arm.lift)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground">Conversion, customers with at least 10 orders</p>
              <div className="mt-3 flex h-44 items-end gap-6">
                {readout.arms.map((arm) => (
                  <div key={arm.id} className="flex h-full flex-1 flex-col justify-end">
                    <div className="flex h-full items-end justify-center">
                      <div
                        className="flex w-14 items-start justify-center rounded-t-md text-[11px] font-medium text-white"
                        style={{
                          height: `${Math.max(8, (arm.conversion ?? 0) * 100)}%`,
                          background: COLORS[arm.id] ?? COLORS.control,
                        }}
                      >
                        <span className="pt-1">{arm.converted.toLocaleString("en-US")}</span>
                      </div>
                    </div>
                    <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">{arm.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 max-w-full overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-xs">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-normal">Variant</th>
                    <th className="px-3 py-2 text-right font-normal">Exposure</th>
                    <th className="px-3 py-2 text-right font-normal">Conversion</th>
                    <th className="px-3 py-2 text-right font-normal">Relative change</th>
                    <th className="px-3 py-2 font-normal">95% interval</th>
                    <th className="px-3 py-2 text-right font-normal">Confidence</th>
                    <th className="px-3 py-2 text-right font-normal">Exposure needed</th>
                  </tr>
                </thead>
                <tbody>
                  {readout.arms.map((arm) => {
                    const reached = arm.pValue != null && arm.pValue < 0.05 && arm.users >= 30;
                    const powered = readout.needed != null && arm.users >= readout.needed && control.users >= readout.needed;
                    return (
                      <tr key={arm.id} className="border-t border-border">
                        <td className="border-t border-border px-3 py-2 whitespace-nowrap">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[arm.id] ?? COLORS.control }} />
                          {arm.name}
                        </td>
                        <td className="border-t border-border px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums">{arm.users.toLocaleString("en-US")} users</td>
                        <td className="border-t border-border px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums">{rate(arm.conversion)}</td>
                        <td className={`border-t border-border px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums ${tone(arm.lift, reached)}`}>{arm.id === "control" ? "Baseline" : liftText(arm.lift)}</td>
                        <td className="border-t border-border px-3 py-2 whitespace-nowrap">{arm.id === "control" ? "—" : <Interval low={arm.ciLow} high={arm.ciHigh} />}</td>
                        <td className="border-t border-border px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums">{arm.id === "control" || arm.pValue == null ? "—" : `${((1 - arm.pValue) * 100).toFixed(1)}%`}</td>
                        <td className="border-t border-border px-3 py-2 text-right whitespace-nowrap">{exposureNeeded(arm.id === "control", reached, powered, readout.needed, arm.users)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Exposure is customers in this arm. The interval is the 95% range for the change in {METRIC_LABEL[plan.metric].toLowerCase()} versus control. These are recorded orders, split by the rollout.
            </p>
          </>
        )}

        {conclusive && status !== "COMPLETED" && (
          <button type="button" className="mt-4 h-8 rounded-md bg-foreground px-3 text-xs text-background" onClick={onResolve}>
            Mark resolved
          </button>
        )}
      </div>
    </section>
  );
}

function Interval({ low, high }: { low: number | null; high: number | null }) {
  if (low == null || high == null) return <span className="text-muted-foreground">—</span>;
  const span = 0.1;
  const place = (value: number) => Math.min(100, Math.max(0, ((value + span) / (span * 2)) * 100));
  const left = place(Math.min(low, high));
  const right = place(Math.max(low, high));
  return (
    <div className="w-40">
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: "50%" }} />
        <div className="absolute inset-y-0 rounded-full bg-foreground/70" style={{ left: `${left}%`, width: `${Math.max(right - left, 2)}%` }} />
      </div>
      <p className="mt-1 font-mono tabular-nums text-muted-foreground">
        {signed(low)} to {signed(high)}
      </p>
    </div>
  );
}

function exposureNeeded(control: boolean, reached: boolean, powered: boolean, needed: number | null, users: number): string {
  if (control) return "Baseline";
  if (reached) return "Stat sig reached";
  if (powered) return "Sample reached";
  if (needed == null) return "—";
  const gap = Math.max(0, needed - users);
  return gap === 0 ? "Sample reached" : `${gap.toLocaleString("en-US")} more`;
}

function formatMetric(value: number | null, metric: ExperimentMetric): string {
  if (value == null) return "—";
  if (metric === "conversion") return rate(value);
  if (metric === "orders") return value.toFixed(2);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function rate(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function liftText(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return signed(value);
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)}%`;
}

function tone(lift: number | null, reached: boolean): string {
  if (!reached || lift == null) return "";
  return lift >= 0 ? "text-emerald-700" : "text-red-600";
}

function since(readout: ExperimentReadout): string {
  if (!readout.startDay) return "Baseline";
  const start = new Date(`${readout.startDay}T00:00:00`);
  return `Since ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
