import { PANTRY } from "@/lib/lab/company";
import type { Readout, SegmentResult } from "@/lib/lab/types";
import { pct, SEGMENT_LABELS } from "./labels";

export function SegmentForest({
  segments,
  recommendation,
}: {
  segments: SegmentResult[];
  recommendation?: Readout["recommendation"];
}) {
  const extent =
    Math.max(0.02, ...segments.flatMap((segment) => [Math.abs(segment.ciLow), Math.abs(segment.ciHigh)])) * 1.15;
  const position = (value: number) => `${((value + extent) / (extent * 2)) * 100}%`;
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold">Effect by segment</h3>
      <div className="mt-2 divide-y rounded-md border">
        {segments.map((segment) => {
          const positive = segment.ciLow > 0;
          const left = Math.min(segment.ciLow, segment.ciHigh);
          const width = Math.abs(
            Number.parseFloat(position(segment.ciHigh)) - Number.parseFloat(position(segment.ciLow)),
          );
          return (
            <div
              key={segment.segment}
              className={`grid gap-2 px-3 py-3 sm:grid-cols-[120px_150px_minmax(150px,1fr)_70px] sm:items-center ${positive ? "bg-success/5" : ""}`}
            >
              <span className="text-xs font-medium">{SEGMENT_LABELS[segment.segment]}</span>
              <span className="text-[11px] text-muted-foreground">{PANTRY.metrics[segment.metric].label}</span>
              <div className="relative h-5">
                <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: position(0) }} />
                <span
                  className={`absolute top-[9px] h-0.5 ${positive ? "bg-success" : "bg-muted-foreground"}`}
                  style={{ left: position(left), width: `${width}%` }}
                />
                <span
                  className={`absolute top-[6px] h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-background ${positive ? "bg-success" : "bg-muted-foreground"}`}
                  style={{ left: position(segment.lift) }}
                />
              </div>
              <span className={`text-right text-xs font-semibold tabular-nums ${positive ? "text-success" : ""}`}>
                {pct(segment.lift)}
              </span>
            </div>
          );
        })}
      </div>
      {recommendation === "ship_segment" && (
        <p className="mt-2 text-xs text-muted-foreground">
          The effect is concentrated in new cooks, so Kismet ships to them only.
        </p>
      )}
    </div>
  );
}
