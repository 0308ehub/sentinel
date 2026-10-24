"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarPoint, ChartPoint, FunnelStep } from "@/lib/analytics/chart-types";

type ChartKind = "trend" | "area" | "bar" | "funnel";
type TrendMetric = "customers" | "revenue" | "orders";

interface Overview extends Record<string, unknown> {
  source?: string;
  startDay?: string;
  endDay?: string;
  customers?: number;
  transactions?: number;
  revenue?: number;
  products?: number;
  growthLabel?: string;
  momAvailable?: boolean;
  customersNow?: number;
  customersPrev?: number;
  revenueNow?: number;
  revenuePrev?: number;
  trend?: ChartPoint[];
  bars?: BarPoint[];
  funnel?: FunnelStep[];
  hint?: string;
  error?: string;
}

export function ChartsView() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [chart, setChart] = useState<ChartKind>("trend");
  const [metric, setMetric] = useState<TrendMetric>("customers");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/analytics/overview");
        const body = (await res.json()) as Overview;
        if (cancelled) return;
        if (!res.ok) {
          setError(body.hint || body.error || "The warehouse query failed.");
          return;
        }
        setData(body);
      } catch {
        if (!cancelled) setError("The warehouse query failed.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="p-6 text-sm text-muted-foreground">{error}</p>;
  }
  if (!data) {
    return (
      <p className="p-6 text-sm text-muted-foreground" suppressHydrationWarning>
        Reading samples.bakehouse.sales_transactions…
      </p>
    );
  }

  const customerChange = change(data.customersNow ?? 0, data.customersPrev ?? 0);
  const revenueChange = change(data.revenueNow ?? 0, data.revenuePrev ?? 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {data.source} · {data.startDay} to {data.endDay}
          </p>
        </div>
        <Link href="/experiments" className="text-xs text-brand">
          Ship an experiment
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Customers" value={formatCount(data.customers ?? 0)} detail={`${formatCount(data.products ?? 0)} products`} />
        <Stat label="Orders" value={formatCount(data.transactions ?? 0)} detail="All transactions" />
        <Stat label="Revenue" value={formatMoney(data.revenue ?? 0)} detail="Sum of total price" />
        <Stat
          label="Customer growth"
          value={formatChange(customerChange)}
          detail={`${data.growthLabel}. Revenue ${formatChange(revenueChange)}.`}
        />
      </div>
      {!data.momAvailable && (
        <p className="mt-3 text-xs text-muted-foreground">
          Month-over-month needs two calendar months. This table stays inside one month, so growth compares the last 7 days with the 7 days before.
        </p>
      )}

      <div className="mt-6 flex items-center gap-2">
        <ChartButton active={chart === "trend"} onClick={() => setChart("trend")} label="Line" />
        <ChartButton active={chart === "area"} onClick={() => setChart("area")} label="Area" />
        <ChartButton active={chart === "bar"} onClick={() => setChart("bar")} label="Bar" />
        <ChartButton active={chart === "funnel"} onClick={() => setChart("funnel")} label="Funnel" />
        {chart === "trend" && (
          <div className="ml-auto flex gap-2">
            <ChartButton active={metric === "customers"} onClick={() => setMetric("customers")} label="Customers" />
            <ChartButton active={metric === "revenue"} onClick={() => setMetric("revenue")} label="Revenue" />
            <ChartButton active={metric === "orders"} onClick={() => setMetric("orders")} label="Orders" />
          </div>
        )}
      </div>

      <div className="mt-4 h-80 rounded-xl border border-border bg-background p-3">
        {chart === "trend" && <TrendChart points={data.trend ?? []} metric={metric} />}
        {chart === "area" && <AreaTrend points={data.trend ?? []} metric={metric} />}
        {chart === "bar" && <BreakdownChart points={data.bars ?? []} />}
        {chart === "funnel" && <FunnelChart steps={data.funnel ?? []} />}
      </div>
    </div>
  );
}

function TrendChart({ points, metric }: { points: ChartPoint[]; metric: TrendMetric }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip />
        <Line type="monotone" dataKey={metric} stroke="#0571d3" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaTrend({ points, metric }: { points: ChartPoint[]; metric: TrendMetric }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} width={48} axisLine={false} tickLine={false} />
        <Tooltip />
        <Area type="monotone" dataKey={metric} stroke="#0571d3" fill="#0571d3" fillOpacity={0.16} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BreakdownChart({ points }: { points: BarPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} textAnchor="end" />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip />
        <Bar dataKey="revenue" fill="#0571d3" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {steps.map((step, index) => {
        const previous = index === 0 ? step.users : steps[index - 1]?.users ?? step.users;
        const fromPrior = previous > 0 ? step.users / previous : 0;
        return (
          <div key={step.step}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium">{step.step}</span>
              <span className="text-muted-foreground">
                {formatCount(step.users)} · {Math.round(step.conversion * 100)}% of customers
                {index > 0 ? ` · ${Math.round(fromPrior * 100)}% from prior step` : ""}
              </span>
            </div>
            <div className="h-8 rounded-sm bg-muted">
              <div className="h-full rounded-sm bg-[#0571d3]" style={{ width: `${Math.max(step.conversion * 100, 2)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ChartButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );
}

function change(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function formatChange(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}
