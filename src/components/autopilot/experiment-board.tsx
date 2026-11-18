"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Loader2, Play } from "lucide-react";
import { ExperimentDetail } from "@/components/autopilot/experiment-detail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RelativeTime } from "@/components/shared/relative-time";
import type { RolloutPhase } from "@/lib/autopilot/rollout-plan";
import { useVariant } from "@/lib/autopilot/variant";
import type { AutopilotState, Experiment, Goal, Learning, Signal, SuggestionRating } from "@/lib/autopilot/types";

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
  onRated: () => void;
  onSchedule: (experiment: Experiment, phases: RolloutPhase[]) => Promise<void>;
  onCreate: (input: { title: string; change: string; page: string }) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"overview" | "learnings" | "themes">("overview");
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const initialExperiments = useRef(state.experiments);
  // Goals come from the server; a local copy only holds the result of an edit made here. (Keying the
  // whole board on goals instead remounted it and closed whatever experiment was open.)
  const [editedGoals, setGoals] = useState<Goal[] | null>(null);
  const goals = editedGoals ?? state.goals;
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalKind, setGoalKind] = useState<"click" | "visit">("click");
  const [goalValue, setGoalValue] = useState("");
  const variant = useVariant("ap-add-first-experiment-guidance-to-the-exp-v1");

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

  async function addGoal() {
    const metric = goalKind === "click" ? { kind: "click", text: goalValue } : { kind: "visit", path: goalValue };
    const response = await fetch("/api/autopilot/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: goalName, metric }) });
    if (!response.ok) return;
    const latest = await fetch("/api/autopilot/goals", { cache: "no-store" }).then((r) => r.json()) as { goals: Goal[] };
    setGoals(latest.goals); setGoalName(""); setGoalValue("");
  }

  async function removeGoal(id: string) {
    const response = await fetch("/api/autopilot/goals", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setGoals(goals.filter((goal) => goal.id !== id));
  }

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
  const selection: Selection | null = createdFromSignal ? { kind: "experiment", id: createdFromSignal.id } : selected;
  const openExperiment = selection?.kind === "experiment" ? state.experiments.find((experiment) => experiment.id === selection.id) ?? null : null;
  const openSignal =
    selection?.kind === "signal"
      ? state.signals.find((signal) => signal.id === selection.id) ?? null
      : openExperiment
        ? state.signals.find((signal) => signal.id === openExperiment.signalId) ?? null
        : null;

  if (selection && (openExperiment || (selection.kind === "signal" && openSignal))) {
    const suggested = selection.kind === "signal" || (openExperiment != null && SUGGESTED_STATUS.has(openExperiment.status));
    return (
      <ExperimentDetail
        experiment={openExperiment}
        signal={openSignal}
        learning={openExperiment ? state.learnings.find((learning) => learning.experimentId === openExperiment.id) ?? null : null}
        suggested={suggested}
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
        onStart={() => openSignal && onTest(openSignal)}
        onDismissSignal={() => openSignal && onDismiss(openSignal)}
        rating={ratingForSelection(state.ratings, selection)}
        onRated={onRated}
      />
    );
  }

  return (
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
              {goals.length ? <>Goals: {goals.map((goal, index) => <span key={goal.id} title={goal.spec.kind === "click" ? `Visitors who click ${goal.spec.text}` : `Visitors who reach ${goal.spec.path}`}>{index > 0 && " · "}{goal.name} ({(goal.baselineRate * 100).toFixed(1)}%)</span>)}</> : <>Kismet will propose goals once it has seen enough visitors. </>}
              <button type="button" className="ml-1 text-brand hover:underline" onClick={() => setEditingGoals((value) => !value)}>{goals.length ? "Edit" : "Add one"}</button>
            </div>
            {editingGoals && (
              <div className="mt-2 max-w-2xl rounded border border-[#e1e4e8] p-2 text-xs">
                {goals.map((goal) => <div key={goal.id} className="flex items-center justify-between py-1"><span>{goal.name}</span><button type="button" aria-label={`Remove ${goal.name}`} className="text-[#6b7280] hover:text-red-600" onClick={() => void removeGoal(goal.id)}>Remove</button></div>)}
                <div className="mt-2 flex flex-wrap gap-2">
                  <input aria-label="Goal name" value={goalName} onChange={(e) => setGoalName(e.target.value)} maxLength={60} placeholder="Goal name" className="h-8 rounded border px-2" />
                  <select aria-label="Goal metric kind" value={goalKind} onChange={(e) => setGoalKind(e.target.value as "click" | "visit")} className="h-8 rounded border px-2"><option value="click">Click</option><option value="visit">Visit</option></select>
                  <input aria-label={goalKind === "click" ? "Click label" : "Visit path"} value={goalValue} onChange={(e) => setGoalValue(e.target.value)} placeholder={goalKind === "click" ? "Button label" : "/path"} className="h-8 rounded border px-2" />
                  <button type="button" disabled={!goalName.trim() || !goalValue.trim() || goals.length >= 5} className="h-8 rounded border px-3 disabled:opacity-50" onClick={() => void addGoal()}>Add</button>
                </div>
              </div>
            )}
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
        <div className="mt-4 flex gap-6 border-b border-[#e6e8ec] text-sm">
          <button type="button" onClick={() => setTab("overview")} className={tab === "overview" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Overview</button>
          <button type="button" onClick={() => setTab("learnings")} className={tab === "learnings" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Learnings</button>
          <button type="button" onClick={() => setTab("themes")} className={tab === "themes" ? "border-b-2 border-brand pb-2 font-medium text-brand" : "pb-2 text-[#6b7280]"}>Themes</button>
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
        ) : (
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
                        <span className={row.suggested ? "font-medium text-[#111827]" : "font-medium text-brand"}>{row.name}</span>
                        {row.suggested && (
                          <span className="rounded border border-[#c7d7fe] bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                            Suggested
                          </span>
                        )}
                        {row.kind === "signal" && row.signal.snoozedUntil && <span className="text-xs text-[#9aa0a8]">Waiting for more traffic</span>}
                      </div>
                      <div className="text-xs text-[#9aa0a8]">{row.key}</div>
                    </td>
                    <td className="whitespace-nowrap">{row.kind === "experiment" ? row.experiment.kind === "fix" ? "Fix" : row.experiment.kind === "change" ? "Change" : "A/B Test" : row.signal.kind === "bug" ? "Fix" : "A/B Test"}</td>
                    <td>{row.feature}</td>
                    <td>
                      <Env live={row.live} muted={row.suggested} />
                    </td>
                    <td className="whitespace-nowrap">{formatDay(row.modified)}</td>
                    <td className="whitespace-nowrap">{formatDay(row.created)}</td>
                    <td className="text-right">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-1 text-xs ${
                          row.suggested ? "border-[#d5d8de] text-[#374151]" : "border-brand text-brand"
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
  onCreate: (input: { title: string; change: string; page: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [change, setChange] = useState("");
  const [page, setPage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onCreate({ title: title.trim(), change: change.trim(), page: page.trim() });
      setTitle("");
      setChange("");
      setPage("");
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
