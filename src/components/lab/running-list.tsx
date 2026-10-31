"use client";

import Link from "next/link";
import { Line, ResponsiveContainer, Tooltip, YAxis, LineChart } from "recharts";
import type { LabExperiment } from "@/lib/lab/advance";
import { PANTRY } from "@/lib/lab/company";
import { EmptyState, LabSection } from "./lab-ui";
import { objectiveLabel } from "./labels";

function statusColor(status: "ok" | "watch" | "breached") {
  return status === "breached" ? "bg-destructive" : status === "watch" ? "bg-warning" : "bg-success";
}

function MiniChart({ experiment, elapsed }: { experiment: LabExperiment; elapsed: number }) {
  const design = experiment.design;
  const daily = (experiment.run?.daily ?? []).filter((point) => point.day <= elapsed);
  const data = Array.from({ length: design?.durationDays ?? elapsed }, (_, index) => {
    const day = index + 1;
    const boundaryIndex = design?.lookDays.findIndex((lookDay) => day <= lookDay) ?? 0;
    const resolvedIndex = boundaryIndex < 0 ? (design?.boundaries.length ?? 1) - 1 : boundaryIndex;
    const boundary = design?.boundaries[resolvedIndex]?.efficacyZ ?? 2;
    return { day, z: daily.find((point) => point.day === day)?.z, boundary, negative: -boundary };
  });
  const boundary = experiment.design?.boundaries.at(-1)?.efficacyZ ?? 2;
  return (
    <div className="h-8 w-[120px] shrink-0" aria-label="Daily z-score sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
          <YAxis domain={[-boundary - 0.5, boundary + 0.5]} hide />
          <Line
            dataKey="boundary"
            type="stepAfter"
            dot={false}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 2"
            isAnimationActive={false}
          />
          <Line
            dataKey="negative"
            type="stepAfter"
            dot={false}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 2"
            isAnimationActive={false}
          />
          <Tooltip content={() => null} />
          <Line
            dataKey="z"
            type="monotone"
            dot={false}
            stroke="var(--primary)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RunningRow({ experiment, day, all }: { experiment: LabExperiment; day: number; all: LabExperiment[] }) {
  const design = experiment.design;
  const elapsed = experiment.launchedDay === null ? 0 : Math.max(1, day - experiment.launchedDay + 1);
  const passed = experiment.run?.looks.filter((look) => look.day <= elapsed) ?? [];
  const latest = passed.at(-1);
  if (experiment.stage === "queued") {
    const blocker = all.find((item) => item.id === experiment.queuedBehind);
    return (
      <Link href={`/experiments/${experiment.id}`} className="block border-b py-3 last:border-0 hover:text-primary">
        <b className="text-sm">{experiment.proposal.title}</b>
        <p className="mt-1 text-xs text-warning">
          Waiting for {blocker?.proposal.title ?? "the active test"} to finish (same file:{" "}
          {experiment.proposal.files[0]}).
        </p>
      </Link>
    );
  }
  const progress = design ? Math.min(100, (elapsed / design.durationDays) * 100) : 0;
  return (
    <Link href={`/experiments/${experiment.id}`} className="block border-b py-3 last:border-0 hover:text-primary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm">{experiment.proposal.title}</b>
        <span className="rounded border bg-muted px-2 py-0.5 text-[11px]">
          {objectiveLabel(experiment.proposal.objective)}
        </span>
      </div>
      <div className="mt-3 grid items-center gap-3 sm:grid-cols-[minmax(180px,1fr)_auto_120px_auto]">
        <div>
          <div className="relative h-1.5 overflow-visible rounded-full bg-muted">
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
            {design?.lookDays.map((lookDay) => (
              <span
                key={lookDay}
                className="absolute top-[-2px] h-2.5 w-px bg-foreground/40"
                style={{ left: `${(lookDay / design.durationDays) * 100}%` }}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            Day {elapsed} of {design?.durationDays}
          </p>
        </div>
        <div className="flex gap-1" aria-label={`${passed.length} looks complete`}>
          {[1, 2, 3, 4, 5].map((look) => {
            const result = passed.find((item) => item.look === look);
            const color = !result
              ? "bg-muted"
              : result.crossed === "harm"
                ? "bg-destructive"
                : result.crossed === "futility"
                  ? "bg-muted-foreground"
                  : result.crossed === "efficacy"
                    ? "bg-success"
                    : "bg-primary";
            return <span key={look} title={`Look ${look}`} className={`h-2 w-2 rounded-full ${color}`} />;
          })}
        </div>
        <MiniChart experiment={experiment} elapsed={elapsed} />
        <div className="flex gap-1" aria-label="Guardrail status">
          {latest?.guardrails.map((guardrail) => (
            <span
              key={guardrail.metric}
              title={PANTRY.metrics[guardrail.metric].label}
              className={`h-2 w-2 rounded-full ${statusColor(guardrail.status)}`}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
        {experiment.updates.filter((update) => update.agent === "analyst").at(-1)?.body ??
          "Analyst is collecting the first sample."}
      </p>
    </Link>
  );
}

export function RunningList({
  experiments,
  all,
  day,
  hasFinished,
}: {
  experiments: LabExperiment[];
  all: LabExperiment[];
  day: number;
  hasFinished: boolean;
}) {
  return (
    <LabSection id="running" title="Running">
      {experiments.length ? (
        experiments.map((experiment) => <RunningRow key={experiment.id} experiment={experiment} day={day} all={all} />)
      ) : (
        <EmptyState>
          {hasFinished ? "Nothing running. Design a proposal to start the next test." : "No tests are live yet."}
        </EmptyState>
      )}
    </LabSection>
  );
}
