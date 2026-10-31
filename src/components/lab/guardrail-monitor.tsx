import { PANTRY } from "@/lib/lab/company";
import type { Design, LookResult } from "@/lib/lab/types";
import { pct, semanticTone } from "./labels";

const statusLabel = { ok: "Within margin", watch: "Watching", breached: "Breached" };

export function GuardrailMonitor({ design, look }: { design: Design; look: LookResult }) {
  const values = look.guardrails.flatMap((result, index) => {
    const guardrail = design.guardrails[index]!;
    const metric = PANTRY.metrics[result.metric];
    const harmfulMargin = metric.higherIsBetter ? -guardrail.margin : guardrail.margin;
    return [result.ciLow, result.ciHigh, harmfulMargin, 0];
  });
  const extent = Math.max(0.02, ...values.map(Math.abs)) * 1.15;
  const position = (value: number) => `${((value + extent) / (extent * 2)) * 100}%`;
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold">Guardrail monitors</h3>
      <div className="mt-2 divide-y rounded-md border">
        {look.guardrails.map((result, index) => {
          const guardrail = design.guardrails[index]!;
          const metric = PANTRY.metrics[result.metric];
          const margin = metric.higherIsBetter ? -guardrail.margin : guardrail.margin;
          const left = Math.min(result.ciLow, result.ciHigh);
          const width = Math.abs(
            Number.parseFloat(position(result.ciHigh)) - Number.parseFloat(position(result.ciLow)),
          );
          const tone = result.status === "breached" ? "harm" : result.status === "watch" ? "watch" : "ok";
          return (
            <div
              key={result.metric}
              className="grid gap-2 px-3 py-3 md:grid-cols-[150px_80px_minmax(160px,1fr)_100px] md:items-center"
            >
              <span className="text-xs font-medium">{metric.label}</span>
              <span className="w-fit rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                {guardrail.action === "stop" ? "Stop now" : "Block ship"}
              </span>
              <div
                className="relative h-5"
                aria-label={`${metric.label} ${pct(result.lift)}, confidence interval ${pct(result.ciLow)} to ${pct(result.ciHigh)}`}
              >
                <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: position(0) }} />
                <span
                  className="absolute inset-y-0 border-l border-dashed border-destructive"
                  style={{ left: position(margin) }}
                />
                <span
                  className="absolute top-[9px] h-0.5 bg-primary"
                  style={{ left: position(left), width: `${width}%` }}
                />
                <span
                  className="absolute top-[6px] h-2 w-2 -translate-x-1/2 rounded-full bg-primary ring-2 ring-background"
                  style={{ left: position(result.lift) }}
                />
              </div>
              <span className={`w-fit rounded-md border px-2 py-0.5 text-[11px] font-semibold ${semanticTone(tone)}`}>
                {statusLabel[result.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
