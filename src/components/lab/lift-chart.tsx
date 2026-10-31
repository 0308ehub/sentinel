"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabExperiment } from "@/lib/lab/advance";

function tooltipValue(value: unknown): string {
  return typeof value === "number" ? value.toFixed(2) : "—";
}

export function LiftChart({ experiment, elapsed }: { experiment: LabExperiment; elapsed: number }) {
  const design = experiment.design!;
  const run = experiment.run!;
  const visibleDays = Math.min(elapsed, run.stopDay);
  const rawVisible = run.daily.filter((point) => point.day <= visibleDays);
  const largestLift = Math.max(2, ...rawVisible.map((point) => Math.abs(point.lift * 100)));
  const chartLimit = Math.min(50, Math.max(10, Math.ceil((largestLift + 6) / 5) * 5));
  const clamp = (value: number) => Math.max(-chartLimit, Math.min(chartLimit, value));
  const visible = rawVisible.map((point) => ({
    day: point.day,
    lift: clamp(point.lift * 100),
    band: [clamp(point.ciLow * 100), clamp(point.ciHigh * 100)],
    low: point.ciLow * 100,
    high: point.ciHigh * 100,
    z: point.z,
  }));
  const stoppedEarly = run.stopDay < design.durationDays && elapsed >= run.stopDay;
  const stoppingLook = stoppedEarly ? run.looks.at(-1) : undefined;
  const boundaryData = Array.from({ length: design.durationDays + 1 }, (_, day) => {
    const index = design.lookDays.findIndex((lookDay) => day <= lookDay);
    const boundary = design.boundaries[index < 0 ? design.boundaries.length - 1 : index]!.efficacyZ;
    const daily = visible.find((point) => point.day === day);
    return { day, z: daily?.z, boundary, negative: -boundary };
  });
  const zExtent = Math.max(
    3.5,
    ...boundaryData.map((point) => point.boundary + 0.4),
    ...visible.map((point) => Math.abs(point.z) + 0.4),
  );
  return (
    <div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visible} margin={{ top: 22, right: 22, bottom: 22, left: 12 }}>
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, design.durationDays]}
              allowDataOverflow
              tick={{ fontSize: 11 }}
              label={{ value: "Experiment day", position: "insideBottom", offset: -14, fontSize: 11 }}
            />
            <YAxis
              domain={[-chartLimit, chartLimit]}
              width={54}
              unit="%"
              tick={{ fontSize: 11 }}
              label={{ value: "Lift vs control", angle: -90, position: "insideLeft", offset: 4, fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-md border bg-popover p-2 text-xs shadow-md">
                    <b>Day {label}</b>
                    <p>Lift {tooltipValue(payload.find((item) => item.dataKey === "lift")?.value)}%</p>
                    <p>
                      95% CI {tooltipValue(payload[0]?.payload?.low)}% to {tooltipValue(payload[0]?.payload?.high)}%
                    </p>
                    <p>z {tooltipValue(payload[0]?.payload?.z)}</p>
                  </div>
                ) : null
              }
            />
            {stoppedEarly && (
              <ReferenceArea
                x1={run.stopDay}
                x2={design.durationDays}
                fill="var(--muted)"
                fillOpacity={0.65}
                label={{
                  value: `Stopped early · ${design.durationDays - run.stopDay} days saved`,
                  position: "insideBottom",
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                }}
              />
            )}
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            {design.lookDays.map((day, index) => (
              <ReferenceLine
                key={day}
                x={day}
                stroke="var(--border)"
                label={{ value: `L${index + 1}`, position: "insideTop", fontSize: 10, fill: "var(--muted-foreground)" }}
              />
            ))}
            <Area dataKey="band" stroke="none" fill="var(--primary)" fillOpacity={0.14} isAnimationActive={false} />
            <Line
              dataKey="lift"
              type="monotone"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {stoppingLook && (
              <ReferenceDot
                x={stoppingLook.day}
                y={clamp(stoppingLook.lift * 100)}
                r={5}
                fill="var(--primary)"
                stroke="var(--background)"
                strokeWidth={2}
                label={{
                  value: `Stopped at look ${stoppingLook.look}`,
                  position: "top",
                  fontSize: 11,
                  fill: "var(--foreground)",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 border-t pt-4">
        <h3 className="text-xs font-semibold">z-score vs stopping boundary</h3>
        <div className="mt-1 h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={boundaryData} margin={{ top: 8, right: 22, bottom: 18, left: 12 }}>
              <XAxis dataKey="day" type="number" domain={[0, design.durationDays]} tick={{ fontSize: 10 }} />
              <YAxis domain={[-zExtent, zExtent]} ticks={zTicks(zExtent)} width={38} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value, name) => [tooltipValue(value), name === "z" ? "z-score" : "Boundary"]}
                labelFormatter={(day) => `Day ${day}`}
              />
              <ReferenceArea
                y1={-1}
                y2={1}
                fill="var(--muted)"
                fillOpacity={0.6}
                label={{
                  value: "Futility zone",
                  position: "insideRight",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" />
              <Line
                dataKey="boundary"
                type="stepAfter"
                dot={false}
                stroke="var(--destructive)"
                strokeDasharray="4 3"
                isAnimationActive={false}
              />
              <Line
                dataKey="negative"
                type="stepAfter"
                dot={false}
                stroke="var(--destructive)"
                strokeDasharray="4 3"
                isAnimationActive={false}
              />
              <Line
                dataKey="z"
                type="monotone"
                dot={false}
                stroke="var(--primary)"
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** Whole-number ticks so the axis reads 0, ±2, ±4 rather than the raw extent. */
function zTicks(extent: number): number[] {
  const top = Math.floor(extent / 2) * 2;
  return Array.from({ length: top + 1 }, (_, i) => i * 2 - top).filter((tick) => Math.abs(tick) <= extent);
}
