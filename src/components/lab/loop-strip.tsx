"use client";

import { useEffect, useMemo, useState } from "react";
import type { LabExperiment } from "@/lib/lab/advance";
import type { Update } from "@/lib/lab/types";

const dotColor = (experiment: LabExperiment) => {
  if (experiment.readout?.recommendation === "kill") return "bg-destructive";
  if (experiment.readout?.recommendation === "iterate") return "bg-muted-foreground";
  if (experiment.readout) return "bg-success";
  if (experiment.stage === "queued") return "bg-warning";
  return "bg-primary";
};

export function LoopStrip({ experiments, latest }: { experiments: LabExperiment[]; latest?: Update }) {
  const [active, setActive] = useState<string | null>(null);
  const latestId = latest?.id;
  useEffect(() => {
    if (!latestId) return;
    const stage =
      latest?.agent === "scout"
        ? "propose"
        : latest?.agent === "designer"
          ? "design"
          : latest?.agent === "analyst"
            ? "run"
            : "decide";
    const startTimer = window.setTimeout(() => setActive(stage), 0);
    const endTimer = window.setTimeout(() => setActive(null), 2000);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [latest?.agent, latestId]);

  const stages = useMemo(
    () => [
      {
        key: "read",
        label: "Read",
        href: "#proposals",
        items: [] as LabExperiment[],
        count: experiments.length ? 1 : 0,
      },
      {
        key: "propose",
        label: "Propose",
        href: "#proposals",
        items: experiments.filter((item) => ["proposed", "rejected"].includes(item.stage)),
      },
      {
        key: "design",
        label: "Design",
        href: "#needs",
        items: experiments.filter((item) => item.stage === "designed"),
      },
      {
        key: "run",
        label: "Run",
        href: "#running",
        items: experiments.filter((item) => ["running", "queued"].includes(item.stage)),
      },
      {
        key: "decide",
        label: "Decide & ship",
        href: "#decided",
        items: experiments.filter((item) => ["decided", "shipping", "shipped"].includes(item.stage)),
      },
    ],
    [experiments],
  );

  return (
    <nav
      aria-label="Experiment pipeline"
      className="mt-5 grid grid-flow-col auto-cols-[120px] overflow-x-auto rounded-md border bg-card sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-5"
    >
      {stages.map((stage, index) => (
        <a
          key={stage.key}
          href={stage.href}
          className={`relative min-w-0 border-b px-4 py-3 transition-colors hover:bg-muted/60 sm:border-b-0 sm:border-r ${active === stage.key ? "motion-safe:ring-2 motion-safe:ring-inset motion-safe:ring-primary/35" : ""}`}
        >
          {index < stages.length - 1 && (
            <span className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rotate-45 border-r border-t bg-card sm:block" />
          )}
          <span className="text-[11px] text-muted-foreground">0{index + 1}</span>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{stage.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {"count" in stage ? stage.count : stage.items.length}
            </span>
          </div>
          <div className="mt-2 flex h-2 gap-1">
            {stage.items.slice(0, 6).map((item) => (
              <span key={item.id} title={item.proposal.title} className={`h-2 w-2 rounded-full ${dotColor(item)}`} />
            ))}
          </div>
        </a>
      ))}
    </nav>
  );
}
