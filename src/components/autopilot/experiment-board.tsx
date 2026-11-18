"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Play } from "lucide-react";
import { ExperimentDetail } from "@/components/autopilot/experiment-detail";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/shared/relative-time";
import type { AutopilotState, Experiment, Signal } from "@/lib/autopilot/types";

const ENDED = new Set<Experiment["status"]>(["rolled_out", "stopped", "rejected", "failed"]);
const SUGGESTED_STATUS = new Set<Experiment["status"]>(["building", "awaiting_approval"]);
const ACTIVE_EXPERIMENT = new Set<Experiment["status"]>([
  "building",
  "awaiting_approval",
  "queued",
  "running",
  "awaiting_rollout",
]);

type StatusFilter = "active" | "suggested" | "running" | "ended" | "all";

type Selection =
  | { kind: "experiment"; id: string }
  | { kind: "signal"; id: string };

export function ExperimentBoard({
  state,
  running,
  busy,
  message,
  onRun,
  onRemoveSample,
  onTest,
  onDismiss,
  onAct,
}: {
  state: AutopilotState;
  running: boolean;
  busy: string | null;
  message: string | null;
  onRun: () => void;
  onRemoveSample: () => void;
  onTest: (signal: Signal) => void;
  onDismiss: (signal: Signal) => void;
  onAct: (experiment: Experiment, action: "approve" | "reject" | "cancel" | "rollout" | "stop" | "approve-cleanup" | "dismiss-cleanup") => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [selected, setSelected] = useState<Selection | null>(null);

  const taken = useMemo(
    () => new Set(state.experiments.filter((experiment) => ACTIVE_EXPERIMENT.has(experiment.status)).map((experiment) => experiment.signalId)),
    [state.experiments],
  );
  const suggestions = state.signals.filter(
    (signal) => signal.status !== "dismissed" && signal.status !== "stale" && signal.status !== "resolved" && !taken.has(signal.id),
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const experimentRows = state.experiments.map((experiment) => ({
      kind: "experiment" as const,
      experiment,
      suggested: SUGGESTED_STATUS.has(experiment.status),
      name: experiment.title,
      key: experiment.flag,
      description: experiment.hypothesis,
      feature: experiment.page || "None",
      modified: experiment.endedAt || experiment.startedAt || experiment.createdAt,
      created: experiment.createdAt,
      live: experiment.status === "running" || experiment.status === "queued" || experiment.status === "awaiting_rollout",
    }));
    const signalRows = suggestions.map((signal) => ({
      kind: "signal" as const,
      signal,
      suggested: true,
      name: signal.title,
      key: slug(signal.title),
      description: signal.problem,
      feature: signal.area || "None",
      modified: signal.updatedAt,
      created: signal.createdAt,
      live: false,
    }));
    return [...experimentRows, ...signalRows]
      .filter((row) => {
        if (filter === "suggested") return row.suggested;
        if (filter === "running") return row.kind === "experiment" && row.live;
        if (filter === "ended") return row.kind === "experiment" && ENDED.has(row.experiment.status);
        if (filter === "active") return row.kind === "signal" || !ENDED.has(row.experiment.status);
        return true;
      })
      .filter((row) => !needle || `${row.name} ${row.key} ${row.description}`.toLowerCase().includes(needle))
      .sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
  }, [filter, query, state.experiments, suggestions]);

  const createdFromSignal =
    selected?.kind === "signal"
      ? state.experiments.find((experiment) => experiment.signalId === selected.id && ACTIVE_EXPERIMENT.has(experiment.status)) ?? null
      : null;
  const selection: Selection | null = createdFromSignal ? { kind: "experiment", id: createdFromSignal.id } : selected;
  const openExperiment = selection?.kind === "experiment" ? state.experiments.find((experiment) => experiment.id === selection.id) ?? null : null;
  const openSignal =
    selection?.kind === "signal"
      ? suggestions.find((signal) => signal.id === selection.id) ?? null
      : openExperiment
        ? state.signals.find((signal) => signal.id === openExperiment.signalId) ?? null
        : null;

  if (selection && (openExperiment || (selection.kind === "signal" && openSignal))) {
    const suggested = selection.kind === "signal" || (openExperiment != null && SUGGESTED_STATUS.has(openExperiment.status));
    return (
      <ExperimentDetail
        experiment={openExperiment}
        signal={openSignal}
        suggested={suggested}
        busy={busy}
        onBack={() => setSelected(null)}
        onApprove={() => openExperiment && onAct(openExperiment, "approve")}
        onReject={() => openExperiment && onAct(openExperiment, "reject")}
        onCancel={() => openExperiment && onAct(openExperiment, "cancel")}
        onRollout={() => openExperiment && onAct(openExperiment, "rollout")}
        onStop={() => openExperiment && onAct(openExperiment, "stop")}
        onApproveCleanup={() => openExperiment && onAct(openExperiment, "approve-cleanup")}
        onDismissCleanup={() => openExperiment && onAct(openExperiment, "dismiss-cleanup")}
        onStart={() => openSignal && onTest(openSignal)}
        onDismissSignal={() => openSignal && onDismiss(openSignal)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto bg-white">
      <div className="px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-medium text-[#1c1c1c]">Experiments</h1>
            <p className="mt-1 text-xs text-[#6b7280]">
              {state.repo ? `Ships to ${state.repo}. ` : "No repository yet. "}
              {state.lastRunAt ? (
                <>
                  Kismet last looked <RelativeTime date={state.lastRunAt} />.
                </>
              ) : (
                "Kismet has not run yet."
              )}
            </p>
          </div>
          <Button className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={onRun} disabled={running || !state.configured}>
            {running ? <Loader2 className="animate-spin" /> : <Play />}
            Create New Experiment
          </Button>
        </div>
        <div className="mt-4 flex gap-6 border-b border-[#e6e8ec] text-sm">
          <span className="border-b-2 border-[#2563eb] pb-2 font-medium text-[#2563eb]">Overview</span>
        </div>
        {(!state.configured || state.error) && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.error ?? "Kismet needs a database. Set DATABASE_URL and restart."}
          </p>
        )}
        {state.dryRun && (
          <p className="mt-3 text-xs text-[#6b7280]">Dry run: Kismet writes changes but never pushes, merges, or closes anything on GitHub.</p>
        )}
        {!state.synthetic && state.sampleEvidence > 0 && (
          <div className="mt-3 flex items-center justify-between gap-4 text-sm">
            <p className="text-[#6b7280]">{state.sampleEvidence} pieces of sample evidence are still here.</p>
            <Button variant="outline" size="sm" onClick={onRemoveSample} disabled={busy === "sample"}>
              Remove sample data
            </Button>
          </div>
        )}
        {message && <p className="mt-3 text-xs text-[#6b7280]">{message}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, key, or description"
            className="h-9 w-72 rounded border border-[#e1e4e8] px-3 text-sm outline-none focus:border-[#2563eb]"
            aria-label="Filter experiments"
          />
          <label className="relative">
            <span className="sr-only">Status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as StatusFilter)}
              className="h-9 appearance-none rounded border border-[#e1e4e8] bg-white pl-3 pr-8 text-sm"
            >
              <option value="active">Active</option>
              <option value="suggested">Suggested</option>
              <option value="running">Running</option>
              <option value="ended">Ended</option>
              <option value="all">All</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-[#6b7280]" />
          </label>
        </div>
      </div>
      <div className="mt-3 px-6 pb-8">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e6e8ec] text-xs text-[#6b7280]">
              <th className="px-3 py-2 font-medium">Experiment</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Feature</th>
              <th className="px-3 py-2 font-medium">Environments</th>
              <th className="px-3 py-2 font-medium">Modified</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 text-right font-medium">Results</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-sm text-[#6b7280]">
                  {state.experiments.length === 0 && suggestions.length === 0
                    ? "Kismet will suggest experiments here after it reads your evidence."
                    : "No experiments match this filter."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row.kind === "experiment" ? row.experiment.id : row.signal.id;
                return (
                  <tr
                    key={`${row.kind}-${id}`}
                    className="cursor-pointer border-b border-[#eef0f3] text-[#374151] hover:bg-[#f8fafc] [&>td]:px-3"
                    onClick={() => setSelected(row.kind === "experiment" ? { kind: "experiment", id } : { kind: "signal", id })}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={row.suggested ? "font-medium text-[#111827]" : "font-medium text-[#2563eb]"}>{row.name}</span>
                        {row.suggested && (
                          <span className="rounded border border-[#c7d7fe] bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2563eb]">
                            Suggested
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#9aa0a8]">{row.key}</div>
                    </td>
                    <td className="whitespace-nowrap">A/B Test</td>
                    <td>{row.feature}</td>
                    <td>
                      <Env live={row.live} muted={row.suggested} />
                    </td>
                    <td className="whitespace-nowrap">{formatDay(row.modified)}</td>
                    <td className="whitespace-nowrap">{formatDay(row.created)}</td>
                    <td className="text-right">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-1 text-xs ${
                          row.suggested ? "border-[#d5d8de] text-[#374151]" : "border-[#2563eb] text-[#2563eb]"
                        }`}
                      >
                        {row.suggested ? "Review" : "Results"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Env({ live, muted }: { live: boolean; muted: boolean }) {
  return (
    <div className="space-y-1 whitespace-nowrap text-xs">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${live && !muted ? "bg-[#1f9d55]" : "bg-[#c5c9d0]"}`} />
        Production
      </div>
      <div className="flex items-center gap-1.5 text-[#9aa0a8]">
        <span className="h-2 w-2 rounded-full bg-[#d5d8de]" />
        Other environments
      </div>
    </div>
  );
}

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
