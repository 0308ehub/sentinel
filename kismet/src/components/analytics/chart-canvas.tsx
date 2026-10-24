"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExploreMeasure, ExploreResult } from "@/lib/analytics/explore-types";
import { changeLabel, formatAxis, formatCount, formatDuration, formatValue } from "@/lib/analytics/present";
import { cn } from "@/lib/utils";

const COLORS = ["#0571d3", "#16803c", "#7c3aed", "#d97706", "#db2777", "#0f766e", "#111111", "#ca8a04"];

export function ChartCanvas({
  result,
  measure,
  compact = false,
}: {
  result: ExploreResult;
  measure: ExploreMeasure;
  compact?: boolean;
}) {
  if (result.kind === "metric") return <MetricResult result={result} measure={measure} />;
  if (result.kind === "bar") return <BarResult result={result} measure={measure} compact={compact} />;
  if (result.kind === "funnel") return <FunnelResult result={result} compact={compact} />;
  if (result.kind === "table") return <SeriesTable result={result} measure={measure} compact={compact} />;
  return <TrendResult result={result} measure={measure} compact={compact} area={result.kind === "area"} />;
}

function TrendResult({
  result,
  measure,
  compact,
  area,
}: {
  result: ExploreResult;
  measure: ExploreMeasure;
  compact: boolean;
  area: boolean;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const data = result.points.map((point) => ({ day: point.day.slice(5), ...point.values }));
  const visible = result.series.filter((series) => !hidden.includes(series.name));
  const gradient = useId().replace(/:/g, "");
  return (
    <>
      <div className={cn("rounded-xl border border-border bg-background p-3", compact ? "h-52" : "mt-4 h-80")}>
        <ResponsiveContainer width="100%" height="100%">
          {area ? (
            <AreaChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} width={56} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatAxis(measure, value)} />
              <Tooltip formatter={(value) => formatValue(measure, Number(value ?? 0))} />
              {!compact && <Legend />}
              {visible.map((series) => {
                const color = colorFor(result.series, series.name);
                return (
                  <Area
                    key={series.name}
                    type="monotone"
                    dataKey={series.name}
                    stroke={color}
                    fill={`url(#${gradient}-${series.name.replace(/\W/g, "")})`}
                    strokeWidth={2}
                    stackId="stack"
                  />
                );
              })}
              <defs>
                {visible.map((series) => {
                  const color = colorFor(result.series, series.name);
                  const id = `${gradient}-${series.name.replace(/\W/g, "")}`;
                  return (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} width={56} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatAxis(measure, value)} />
              <Tooltip formatter={(value) => formatValue(measure, Number(value ?? 0))} />
              {!compact && <Legend />}
              {visible.map((series) => (
                <Line
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  stroke={colorFor(result.series, series.name)}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {!compact && <SeriesTable result={result} measure={measure} hidden={hidden} onToggle={setHidden} />}
    </>
  );
}

function BarResult({ result, measure, compact }: { result: ExploreResult; measure: ExploreMeasure; compact: boolean }) {
  const data = result.bars.map((bar) => ({ label: bar.label, value: bar.value }));
  const height = Math.max(compact ? 200 : 280, data.length * 36);
  return (
    <>
      <div className={cn("rounded-xl border border-border bg-background p-3", compact ? "" : "mt-4")} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatAxis(measure, value)} />
            <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => formatValue(measure, Number(value ?? 0))} />
            <Bar dataKey="value" fill="#0571d3" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!compact && <ShareTable result={result} measure={measure} />}
    </>
  );
}

function MetricResult({ result, measure }: { result: ExploreResult; measure: ExploreMeasure }) {
  const value = result.metricValue ?? 0;
  const change = changeLabel(value, result.metricPrevious);
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-5">
      <p className="font-mono text-4xl font-medium tabular-nums">{formatValue(measure, value)}</p>
      {change && <p className="mt-2 text-xs text-muted-foreground">{change}</p>}
    </div>
  );
}

function FunnelResult({ result, compact }: { result: ExploreResult; compact: boolean }) {
  const first = result.steps[0]?.users ?? 0;
  return (
    <>
      <div className={cn("rounded-xl border border-border bg-background p-4", compact ? "" : "mt-4")}>
        {!compact && (
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] text-muted-foreground">
              {result.steps[0]?.name} to {result.steps[result.steps.length - 1]?.name}
            </p>
            <p className="text-right">
              <span className="block text-[11px] text-muted-foreground">Total conversion</span>
              <span className="text-2xl font-semibold">
                {result.totalConversion == null ? "—" : `${(result.totalConversion * 100).toFixed(2)}%`}
              </span>
            </p>
          </div>
        )}
        <div className={cn("flex items-end gap-3", compact ? "h-40" : "mt-3 h-56")}>
          {result.steps.map((step, index) => {
            const height = Math.max((first > 0 ? step.users / first : 0) * 100, step.users > 0 ? 8 : 0);
            return (
              <div key={`${step.name}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <p className="mb-1 text-center text-sm font-semibold">{formatCount(step.users)}</p>
                <div className="rounded-sm bg-[#0571d3]" style={{ height: `${height}%` }} />
                <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">{step.name}</p>
              </div>
            );
          })}
        </div>
      </div>
      {!compact && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left font-medium">Step</th>
                <th className="px-3 py-2 text-right font-medium">Users</th>
                <th className="px-3 py-2 text-right font-medium">Conversion</th>
                <th className="px-3 py-2 text-right font-medium">From prior</th>
                <th className="px-3 py-2 text-right font-medium">Median time</th>
              </tr>
            </thead>
            <tbody>
              {result.steps.map((step, index) => (
                <tr key={`${step.name}-${index}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {index + 1}. {step.name}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatCount(step.users)}</td>
                  <td className="px-3 py-2 text-right font-mono">{Math.round(step.conversion * 100)}%</td>
                  <td className="px-3 py-2 text-right font-mono">{index === 0 ? "—" : `${Math.round(step.fromPrior * 100)}%`}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatDuration(step.medianSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SeriesTable({
  result,
  measure,
  compact = false,
  hidden = [],
  onToggle,
}: {
  result: ExploreResult;
  measure: ExploreMeasure;
  compact?: boolean;
  hidden?: string[];
  onToggle?: (names: string[]) => void;
}) {
  const points = compact ? result.points.slice(-8) : result.points;
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border", compact ? "" : "mt-4")}>
      <table className="w-full whitespace-nowrap text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-medium">Event</th>
            {points.map((point) => (
              <th key={point.day} className="px-3 py-2 text-right font-medium">
                {point.day.slice(5)}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Average</th>
          </tr>
        </thead>
        <tbody>
          {result.series.map((series) => {
            const values = points.map((point) => point.values[series.name] ?? 0);
            const max = Math.max(...values, 0);
            const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
            const off = hidden.includes(series.name);
            return (
              <tr key={series.name} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  {onToggle ? (
                    <button
                      type="button"
                      className={cn("flex items-center gap-2", off && "text-muted-foreground line-through")}
                      onClick={() => onToggle(off ? hidden.filter((name) => name !== series.name) : [...hidden, series.name])}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: colorFor(result.series, series.name) }} />
                      {series.name}
                    </button>
                  ) : (
                    series.name
                  )}
                </td>
                {values.map((value, index) => (
                  <td
                    key={points[index]?.day}
                    className="px-3 py-2 text-right font-mono"
                    style={{ background: wash(value, max) }}
                  >
                    {formatValue(measure, value)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono">{formatValue(measure, average)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ShareTable({ result, measure }: { result: ExploreResult; measure: ExploreMeasure }) {
  const total = result.bars.reduce((sum, bar) => sum + bar.value, 0);
  const max = Math.max(...result.bars.map((bar) => bar.value), 0);
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-medium">Breakdown</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="px-3 py-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {result.bars.map((bar) => (
            <tr key={bar.label} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{bar.label}</td>
              <td className="px-3 py-2 text-right font-mono" style={{ background: wash(bar.value, max) }}>
                {formatValue(measure, bar.value)}
              </td>
              <td className="px-3 py-2 text-right font-mono">{total > 0 ? `${Math.round((bar.value / total) * 100)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function colorFor(series: { name: string }[], name: string): string {
  const index = series.findIndex((item) => item.name === name);
  return COLORS[(index < 0 ? 0 : index) % COLORS.length];
}

function wash(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "transparent";
  return `color-mix(in srgb, var(--brand) ${Math.round((value / max) * 28)}%, transparent)`;
}
