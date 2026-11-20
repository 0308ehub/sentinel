"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, ChevronDown, Circle, Loader2, MoreHorizontal, Play } from "lucide-react";
import { BuilderMenu, useAccountBuilder } from "@/components/autopilot/builder-menu";
import { ExperimentDetail } from "@/components/autopilot/experiment-detail";
import { ExperimentSessions } from "@/components/autopilot/experiment-sessions";
import { SpendOverview } from "@/components/autopilot/spend-overview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RelativeTime } from "@/components/shared/relative-time";
import { describeMetric } from "@/lib/autopilot/assign";
import type { Builder } from "@/lib/autopilot/builders";
import type { RolloutPhase } from "@/lib/autopilot/rollout-plan";
import { useVariant } from "@/lib/autopilot/variant";
import { formatRelativeTime } from "@/lib/utils";
import { setupSteps } from "@/lib/autopilot/setup-core";
import type { AutopilotState, Experiment, Learning, Signal, SuggestionRating } from "@/lib/autopilot/types";

const ENDED = new Set<Experiment["status"]>(["rolled_out", "stopped", "rejected", "failed"]);
const SUGGESTED_STATUS = new Set<Experiment["status"]>(["building", "awaiting_approval"]);
const ACTIVE_EXPERIMENT = new Set<Experiment["status"]>([
  "building",
  "awaiting_approval",
  "queued",
  "running",
  "awaiting_rollout",
  "rolling_out",
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
  onRated,
  onSchedule,
  onCreate,
  onSaveAdjustments,
}: {
  state: AutopilotState;
  running: boolean;
  busy: string | null;
  message: string | null;
  onRun: () => void;
  onRemoveSample: () => void;
  onTest: (signal: Signal, builder: Builder) => void;
  onDismiss: (signal: Signal) => void;
  onAct: (experiment: Experiment, action: "approve" | "reject" | "cancel" | "rollout" | "stop" | "approve-cleanup" | "dismiss-cleanup") => void;
  onRated: () => void;
  onSchedule: (experiment: Experiment, phases: RolloutPhase[]) => Promise<void>;
  onCreate: (input: { title: string; change: string; page: string; builder: Builder }) => Promise<void>;
  onSaveAdjustments: (target: Signal | Experiment, adjustments: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"overview" | "learnings" | "themes" | "activity" | "spend">("overview");
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const initialExperiments = useRef(state.experiments);
  const goals = state.goals;
  const [renderedAt] = useState(() => Date.now());
  const variant = useVariant("ap-add-first-experiment-guidance-to-the-exp-v1");
  const setup = setupSteps(state.setup);
  const setupComplete = setup.every((step) => step.done);
  const missedRun = state.health.lastRunAt != null && renderedAt - Date.parse(state.health.lastRunAt) > 150 * 60_000;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("experiment");
    if (!id || !initialExperiments.current.some((experiment) => experiment.id === id)) return;
    const frame = requestAnimationFrame(() => setSelected({ kind: "experiment", id }));
    return () => cancelAnimationFrame(frame);
  }, []);

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
      live: experiment.status === "running" || experiment.status === "queued" || experiment.status === "awaiting_rollout" || experiment.status === "rolling_out",
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
  // Once a suggestion becomes an experiment, follow the experiment itself, so it stays open after it merges
  // or ends instead of falling back to the (now resolved) suggestion.
  if (createdFromSignal && selected?.kind === "signal") setSelected({ kind: "experiment", id: createdFromSignal.id });
  const selection: Selection | null = createdFromSignal ? { kind: "experiment", id: createdFromSignal.id } : selected;
  const openExperiment = selection?.kind === "experiment" ? state.experiments.find((experiment) => experiment.id === selection.id) ?? null : null;
  const openSignal =
    selection?.kind === "signal"
      ? state.signals.find((signal) => signal.id === selection.id) ?? null
      : openExperiment
        ? state.signals.find((signal) => signal.id === openExperiment.signalId) ?? null
        : null;

  const open = selection && (openExperiment || (selection.kind === "signal" && openSignal));
  const suggested = selection?.kind === "signal" || (openExperiment != null && SUGGESTED_STATUS.has(openExperiment.status));

  return (
    <div className="flex h-full min-h-0 bg-white">
      <ExperimentSessions
        experiments={state.experiments}
        selectedId={selection?.kind === "experiment" ? selection.id : null}
        running={running}
        onOpen={(id) => setSelected({ kind: "experiment", id })}
        onCreate={() => setCreating(true)}
        onStop={(experiment) => onAct(experiment, "cancel")}
        onRun={onRun}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        {open ? (
          <ExperimentDetail
            experiment={openExperiment}
            signal={openSignal}
            learning={openExperiment ? state.learnings.find((learning) => learning.experimentId === openExperiment.id) ?? null : null}
            suggested={suggested}
            lastFailed={openExperiment ? null : lastFailedAttempt(state.experiments, openSignal?.id ?? null)}
            busy={busy}
            onBack={() => setSelected(null)}
            onApprove={() => openExperiment && onAct(openExperiment, "approve")}
            onReject={() => openExperiment && onAct(openExperiment, "reject")}
            onCancel={() => openExperiment && onAct(openExperiment, "cancel")}
            onRollout={() => openExperiment && onAct(openExperiment, "rollout")}
            onSchedule={(phases) => openExperiment ? onSchedule(openExperiment, phases) : Promise.resolve()}
            onStop={() => openExperiment && onAct(openExperiment, "stop")}
            onApproveCleanup={() => openExperiment && onAct(openExperiment, "approve-cleanup")}
            onDismissCleanup={() => openExperiment && onAct(openExperiment, "dismiss-cleanup")}
            onStart={(builder) => openSignal && onTest(openSignal, builder)}
            onDismissSignal={() => openSignal && onDismiss(openSignal)}
            rating={selection ? ratingForSelection(state.ratings, selection) : null}
            onRated={onRated}
            onSaveAdjustments={(adjustments) => onSaveAdjustments(openExperiment ?? openSignal!, adjustments)}
          />
        ) : (
    <div className="flex h-full flex-col overflow-auto bg-white [scrollbar-gutter:stable]">
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
            <div className="mt-2 text-xs text-[#6b7280]">
              {goals.length ? <>Goals: {goals.map((goal, index) => <span key={goal.id} title={describeMetric(goal.spec)}>{index > 0 && " · "}{goal.name}</span>)} · <Link href="/analytics" className="text-brand hover:underline">Manage in Analytics →</Link></> : <>Kismet will propose goals once it has seen enough visitors. <Link href="/analytics" className="text-brand hover:underline">Manage in Analytics →</Link></>}
            </div>
            {variant === "treatment" && state.experiments.length === 0 && (
              <p data-track="ap-add-first-experiment-guidance-to-the-exp-v1" className="mt-2 max-w-xl text-sm text-[#374151]">
                Experiments help you compare product changes and measure outcomes. Start by letting Kismet suggest a safe first
                experiment from your features, decisions, and analytics.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => setCreating(true)}>Create experiment</Button>
            <Button className="bg-[#111] text-white hover:bg-[#2a2a2a]" onClick={onRun} disabled={running || !state.configured}>
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              Check for suggestions
            </Button>
          </div>
        </div>
        {state.health.failingRuns >= 3 ? (
          <p className="mt-3 text-xs text-amber-700">Kismet&apos;s last {state.health.failingRuns} runs had errors: {state.health.latestError ?? "Unknown error"}</p>
        ) : missedRun ? (
          <p className="mt-3 text-xs text-amber-700">Kismet hasn&apos;t run since <RelativeTime date={state.health.lastRunAt!} />.</p>
        ) : null}
        {!setupComplete && (
          <div className="mt-3 max-w-2xl rounded-md border border-[#e6e8ec] bg-white p-3">
            <p className="text-sm font-medium text-[#111827]">Finish setting up Kismet</p>
            <ul className="mt-2 grid gap-2 text-xs text-[#6b7280] sm:grid-cols-2">
              {setup.map((step) => (
                <li key={step.key} className="flex items-start gap-2">
                  {step.done ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b4bac2]" />}
                  <span>
                    {step.key === "slack" && <><a href="/settings/connectors" className="font-medium text-[#374151] hover:underline">Connect Slack</a></>}
                    {step.key === "repo" && <><a href="/settings/connectors" className="font-medium text-[#374151] hover:underline">Choose the repository Kismet ships to</a></>}
                    {step.key === "agent" && <><span className="font-medium text-[#374151]">Coding agent ready</span>{!step.done && <span> — Kismet will write changes once the GitHub app can push to your repo</span>}</>}
                    {step.key === "firstRun" && <><span className="font-medium text-[#374151]">First run finished</span>{!step.done && <button type="button" onClick={onRun} disabled={running} className="ml-2 text-brand hover:underline disabled:opacity-50">Run now</button>}</>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex gap-6 border-b border-[#e6e8ec] text-sm">
          <button type="button" onClick={() => setTab("overview")} className={tab === "overview" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Overview</button>
          <button type="button" onClick={() => setTab("learnings")} className={tab === "learnings" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Learnings</button>
          <button type="button" onClick={() => setTab("themes")} className={tab === "themes" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Themes</button>
          <button type="button" onClick={() => setTab("activity")} className={tab === "activity" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Activity</button>
          <button type="button" onClick={() => setTab("spend")} className={tab === "spend" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Spend</button>
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
        {tab === "overview" && <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, key, or description"
            className="h-9 w-72 rounded border border-[#e1e4e8] px-3 text-sm outline-none focus:border-brand"
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
        </div>}
      </div>
      <div className="mt-3 px-6 pb-8">
        {tab === "learnings" ? (
          <LearningsTable learnings={state.learnings} onOpen={(id) => setSelected({ kind: "experiment", id })} />
        ) : tab === "themes" ? (
          <ThemesTable themes={state.themes} onOpen={(id) => setSelected({ kind: "signal", id })} />
        ) : tab === "activity" ? (
          <ActivityTable
            activity={state.activity}
            experiments={state.experiments}
            signals={state.signals}
            onOpen={setSelected}
          />
        ) : tab === "spend" ? (
          <SpendOverview />
        ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e6e8ec] text-xs text-[#6b7280]">
              <th className="px-3 py-2 font-medium">Experiment</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Feature</th>
              <th className="px-3 py-2 font-medium">Environments</th>
              <th className="px-3 py-2 font-medium">
                <span className="inline-flex items-center gap-1">Modified <ChevronDown className="h-3 w-3" /></span>
              </th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Results</th>
              <th className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-sm text-[#6b7280]">
                  {state.experiments.length === 0 && suggestions.length === 0
                    ? "Kismet will suggest experiments here after it reads your evidence."
                    : "No experiments match this filter."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row.kind === "experiment" ? row.experiment.id : row.signal.id;
                const feature = featureNotation(row.feature);
                const open = () => setSelected(row.kind === "experiment" ? { kind: "experiment", id } : { kind: "signal", id });
                const places = environmentsFor(row);
                return (
                  <tr
                    key={`${row.kind}-${id}`}
                    className="cursor-pointer border-b border-[#eef0f3] text-sm text-[#374151] hover:bg-[#f8fafc] [&>td]:px-3"
                    onClick={open}
                  >
                    <td className="py-3.5">
                      <div className="font-medium text-brand">{row.name}</div>
                      <div className="mt-0.5 text-xs text-[#8b919a]">{row.key}</div>
                      {row.kind === "signal" && row.signal.snoozedUntil && <div className="mt-0.5 text-xs text-[#9aa0a8]">Waiting for more traffic</div>}
                    </td>
                    <td className="whitespace-nowrap">{typeLabel(row)}</td>
                    <td>
                      <div>{feature.name}</div>
                      {feature.key && <div className="mt-0.5 text-xs text-[#8b919a]">{feature.key}</div>}
                    </td>
                    <td>
                      <Environments other={places.other} production={places.production} />
                    </td>
                    <td className="whitespace-nowrap">{formatDay(row.modified)}</td>
                    <td className="whitespace-nowrap">{formatDay(row.created)}</td>
                    <td>
                      <span className={`inline-flex h-7 items-center rounded border px-2.5 text-xs ${hasResults(row) ? "border-brand text-brand" : "border-[#d5d8de] text-[#9aa0a8]"}`}>
                        Results
                      </span>
                    </td>
                    <td className="text-right" onClick={(event) => event.stopPropagation()}>
                      <RowMenu name={row.name} onOpen={open} onStop={row.kind === "experiment" && places.production && row.experiment.status !== "rolled_out" ? () => onAct(row.experiment, "stop") : null} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
        )}
      </div>
      <CreateExperimentDialog open={creating} busy={busy === "create"} onOpenChange={setCreating} onCreate={onCreate} />
    </div>
  );
}

function CreateExperimentDialog({
  open,
  busy,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { title: string; change: string; page: string; builder: Builder }) => Promise<void>;
}) {
  const accountBuilder = useAccountBuilder();
  const [title, setTitle] = useState("");
  const [change, setChange] = useState("");
  const [page, setPage] = useState("");
  const [picked, setPicked] = useState<Builder | null>(null);
  const [error, setError] = useState("");
  const builder = picked ?? accountBuilder;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onCreate({ title: title.trim(), change: change.trim(), page: page.trim(), builder });
      setTitle("");
      setChange("");
      setPage("");
      setPicked(null);
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the experiment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <form onSubmit={(event) => void submit(event)}>
          <div className="border-b border-[#eef0f3] px-5 py-4">
            <h2 className="text-base font-medium text-[#111]">Create experiment</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <label className="block text-sm">
              <span className="text-[#374151]">Name</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Homepage banner" className="mt-1 h-9 w-full rounded-md border border-[#e1e4e8] px-3 text-sm outline-none focus:border-[#111]" />
            </label>
            <label className="block text-sm">
              <span className="text-[#374151]">What should change</span>
              <textarea value={change} onChange={(event) => setChange(event.target.value)} required rows={4} placeholder="Showing items you may like on the homepage banner will increase purchases" className="mt-1 w-full resize-none rounded-md border border-[#e1e4e8] px-3 py-2 text-sm outline-none focus:border-[#111]" />
            </label>
            <BuilderMenu value={builder} onChange={setPicked} />
            <label className="block text-sm">
              <span className="text-[#6b7280]">Page, if you know it</span>
              <input value={page} onChange={(event) => setPage(event.target.value)} placeholder="/home" className="mt-1 h-9 w-full rounded-md border border-[#e1e4e8] px-3 text-sm outline-none focus:border-[#111]" />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#eef0f3] px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" className="bg-[#111] text-white hover:bg-[#2a2a2a]" disabled={busy || change.trim().length < 8}>
              {busy && <Loader2 className="animate-spin" />}
              Create experiment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityTable({
  activity,
  experiments,
  signals,
  onOpen,
}: {
  activity: AutopilotState["activity"];
  experiments: Experiment[];
  signals: Signal[];
  onOpen: (selection: Selection) => void;
}) {
  const experimentIds = new Set(experiments.map((experiment) => experiment.id));
  const signalIds = new Set(signals.map((signal) => signal.id));
  const rows = [...activity].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-[#e6e8ec] text-xs text-[#6b7280]">
          <th className="px-3 py-2 font-medium">When</th>
          <th className="px-3 py-2 font-medium">Kind</th>
          <th className="px-3 py-2 font-medium">Activity</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={3} className="px-3 py-8 text-sm text-[#6b7280]">
              Nothing yet. Kismet logs each step of its loop here.
            </td>
          </tr>
        ) : rows.map((item) => {
          const selection = item.ref && experimentIds.has(item.ref)
            ? { kind: "experiment" as const, id: item.ref }
            : item.ref && signalIds.has(item.ref)
              ? { kind: "signal" as const, id: item.ref }
              : null;
          const error = item.kind === "error";
          return (
            <tr
              key={item.id}
              className={`${selection ? "cursor-pointer hover:bg-[#f8fafc]" : ""} border-b border-[#eef0f3] ${error ? "text-red-600" : "text-[#374151]"} [&>td]:px-3`}
              onClick={() => selection && onOpen(selection)}
            >
              <td className="whitespace-nowrap py-3 text-xs">{formatRelativeTime(item.at)}</td>
              <td>
                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${error ? "border-red-200 bg-red-50 text-red-600" : "border-[#d5d8de] bg-[#f8fafc] text-[#6b7280]"}`}>
                  {item.kind}
                </span>
              </td>
              <td className="py-3">{item.message}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The most recent attempt at this problem that failed, so a reopened problem can say why. */
function lastFailedAttempt(experiments: Experiment[], signalId: string | null): Experiment | null {
  if (!signalId) return null;
  const failed = experiments.filter((experiment) => experiment.signalId === signalId && experiment.status === "failed");
  return failed.sort((a, b) => Date.parse(b.endedAt ?? b.createdAt) - Date.parse(a.endedAt ?? a.createdAt))[0] ?? null;
}

function ratingForSelection(ratings: SuggestionRating[], selection: Selection): SuggestionRating | null {
  return ratings.find((rating) => rating.targetKind === selection.kind && rating.targetId === selection.id) ?? null;
}

function ThemesTable({ themes, onOpen }: { themes: AutopilotState["themes"]; onOpen: (signalId: string) => void }) {
  const trend = { rising: "↑ rising", steady: "→ steady", falling: "↓ falling" } as const;
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead><tr className="border-b border-[#e6e8ec] text-xs text-[#6b7280]">
        <th className="px-3 py-2 font-medium">Theme</th><th className="px-3 py-2 font-medium">People</th>
        <th className="px-3 py-2 font-medium">Mentions</th><th className="px-3 py-2 font-medium">Trend</th>
        <th className="px-3 py-2 font-medium">Also in the numbers</th><th className="px-3 py-2 font-medium">Quotes</th>
      </tr></thead>
      <tbody>{themes.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-sm text-[#6b7280]">Themes appear as Kismet reads feedback, Slack, tickets and what you told it.</td></tr> : themes.map((theme) => (
        <tr key={theme.signalId} tabIndex={0} className="cursor-pointer border-b border-[#eef0f3] text-[#374151] hover:bg-[#f8fafc] focus:bg-[#f8fafc] [&>td]:px-3" onClick={() => onOpen(theme.signalId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(theme.signalId); } }}>
          <td className="max-w-sm py-3"><div className="flex items-center gap-2"><span className="font-medium text-[#111827]">{theme.title}</span>{theme.kind && <span className="rounded border border-[#d5d8de] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#6b7280]">{theme.kind === "bug" ? "Bug" : "Idea"}</span>}</div><div className="mt-0.5 text-xs text-[#9aa0a8]">{theme.problem}</div></td>
          <td>{theme.people}</td><td>{theme.mentions}</td><td className="whitespace-nowrap">{trend[theme.trend]}</td>
          <td className="text-center" aria-label={theme.hasNumbers ? "Also in the numbers" : "Not in the numbers"}>{theme.hasNumbers ? "✓" : "—"}</td>
          <td className="max-w-lg py-3"><ul className="space-y-1 text-xs">{theme.quotes.map((quote, index) => <li key={`${quote.source}-${index}`}>“{quote.text}” <span className="text-[#9aa0a8]">— {quote.source}{quote.author ? ` · ${quote.author}` : ""}</span></li>)}</ul></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function LearningsTable({ learnings, onOpen }: { learnings: Learning[]; onOpen: (experimentId: string) => void }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead><tr className="border-b border-[#e6e8ec] text-xs text-[#6b7280]">
        <th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Experiment</th>
        <th className="px-3 py-2 font-medium">Outcome</th><th className="px-3 py-2 font-medium">Lift</th>
        <th className="px-3 py-2 font-medium">Learning</th>
      </tr></thead>
      <tbody>{learnings.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-sm text-[#6b7280]">Kismet writes down what each finished experiment taught it. Nothing has finished yet.</td></tr> : learnings.map((learning) => (
        <tr key={learning.id} className="border-b border-[#eef0f3] text-[#374151] hover:bg-[#f8fafc] [&>td]:px-3">
          <td className="whitespace-nowrap py-3">{formatDay(learning.createdAt)}</td>
          <td><button type="button" className="text-left font-medium text-brand hover:underline" onClick={() => onOpen(learning.experimentId)}>{learning.title}</button></td>
          <td><LearningBadge outcome={learning.outcome} /></td>
          <td className="whitespace-nowrap">{learning.lift == null ? "—" : `${learning.lift > 0 ? "+" : ""}${(learning.lift * 100).toFixed(1)}%`}</td>
          <td className="max-w-xl py-3 leading-5">{learning.learning}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function LearningBadge({ outcome }: { outcome: Learning["outcome"] }) {
  const styles = outcome === "won" ? "border-green-200 bg-green-50 text-green-700"
    : outcome === "lost" ? "border-red-200 bg-red-50 text-red-700"
      : outcome === "rejected" ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[#d5d8de] bg-[#f8fafc] text-[#6b7280]";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${styles}`}>{outcome[0].toUpperCase() + outcome.slice(1)}</span>;
}

function typeLabel(row: { kind: "experiment"; experiment: Experiment } | { kind: "signal"; signal: Signal }): string {
  if (row.kind === "signal") return row.signal.kind === "bug" ? "Feature Test" : "A/B Test";
  return row.experiment.kind === "test" ? "A/B Test" : "Feature Test";
}

function featureNotation(value: string): { name: string; key: string | null } {
  const raw = value.trim();
  if (!raw || raw === "None") return { name: "None", key: null };
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  const name = raw.startsWith("/")
    ? raw.split("/").filter(Boolean).map((part) => part.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())).join(" / ") || "Home"
    : raw;
  return { name, key: key || null };
}

function environmentsFor(row: { kind: "experiment"; experiment: Experiment; live: boolean } | { kind: "signal"; live: boolean }): { other: boolean; production: boolean } {
  if (row.kind === "signal") return { other: false, production: false };
  const status = row.experiment.status;
  const production = row.live || status === "rolled_out";
  const other = status === "building" || status === "awaiting_approval" || (Boolean(row.experiment.draftPath || row.experiment.prUrl) && !production);
  return { other, production };
}

function hasResults(row: { kind: "experiment"; experiment: Experiment } | { kind: "signal" }): boolean {
  if (row.kind === "signal") return false;
  const status = row.experiment.status;
  return Boolean(row.experiment.readout || row.experiment.directional) || status === "running" || status === "awaiting_rollout" || status === "rolling_out" || status === "rolled_out" || status === "stopped";
}

function Environments({ other, production }: { other: boolean; production: boolean }) {
  return (
    <div className="space-y-1 whitespace-nowrap text-xs text-[#374151]">
      <div className="flex items-center gap-1.5"><EnvMark on={other} />Other Environments (1)</div>
      <div className="flex items-center gap-1.5"><EnvMark on={production} />Production</div>
    </div>
  );
}

function EnvMark({ on }: { on: boolean }) {
  if (!on) return <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#d9dce1]" aria-hidden />;
  return (
    <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#1f9d55] text-white" aria-hidden>
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  );
}

function RowMenu({ name, onOpen, onStop }: { name: string; onOpen: () => void; onStop: (() => void) | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${name}`} className="rounded p-1 text-[#9aa0a8] hover:bg-[#eef0f3] hover:text-[#374151]">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
        {onStop && <DropdownMenuItem onClick={onStop}>Stop</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
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
