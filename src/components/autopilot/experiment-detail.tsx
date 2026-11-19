"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { BuildLive } from "@/components/autopilot/build-live";
import { CodeChange } from "@/components/autopilot/code-change";
import { WhatChanges } from "@/components/autopilot/what-changes";
import { RolloutScheduleDialog } from "@/components/autopilot/rollout-schedule";
import { Button } from "@/components/ui/button";
import { canLaunch, launchChecks } from "@/lib/autopilot/launch";
import type { RolloutPhase } from "@/lib/autopilot/rollout-plan";
import { maxExperimentDays } from "@/lib/autopilot/thresholds";
import type { ArmResult, Experiment, Learning, Readout, Signal, SuggestionRating } from "@/lib/autopilot/types";

const DECISION_VISITORS = 200;
const PANEL_KEY = "kismet-experiment-panel-width";
const DEFAULT_PANEL_WIDTH = 360;
const panelListeners = new Set<() => void>();

function clampPanelWidth(width: number) {
  return Math.min(600, Math.max(280, Math.round(width)));
}

function readPanelWidth() {
  try {
    const width = Number(localStorage.getItem(PANEL_KEY));
    return Number.isFinite(width) && width > 0 ? clampPanelWidth(width) : DEFAULT_PANEL_WIDTH;
  } catch {
    return DEFAULT_PANEL_WIDTH;
  }
}

function writePanelWidth(width: number) {
  try {
    localStorage.setItem(PANEL_KEY, String(clampPanelWidth(width)));
  } catch {
    // Storage can be blocked; resizing still works for the current pointer interaction.
  }
  panelListeners.forEach((listener) => listener());
}

function subscribePanelWidth(listener: () => void) {
  panelListeners.add(listener);
  return () => panelListeners.delete(listener);
}

interface DailyVisitors {
  day: string;
  control: number;
  treatment: number;
}

export function ExperimentDetail({
  experiment,
  signal,
  learning,
  suggested,
  lastFailed = null,
  busy,
  onBack,
  onApprove,
  onReject,
  onCancel,
  onRollout,
  onSchedule,
  onStop,
  onApproveCleanup,
  onDismissCleanup,
  onStart,
  onDismissSignal,
  rating,
  onRated,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  learning: Learning | null;
  suggested: boolean;
  /** Shown on a reopened problem: the latest attempt that failed. */
  lastFailed?: Experiment | null;
  busy: string | null;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRollout: () => void;
  onSchedule: (phases: RolloutPhase[]) => Promise<void>;
  onStop: () => void;
  onApproveCleanup: () => void;
  onDismissCleanup: () => void;
  onStart: () => void;
  onDismissSignal: () => void;
  rating: SuggestionRating | null;
  onRated: () => void;
}) {
  const title = experiment?.title ?? signal?.title ?? "Experiment";
  const readout = experiment?.readout ?? null;
  const control = readout?.arms.find((arm) => arm.arm === "control") ?? null;
  const treatment = readout?.arms.find((arm) => arm.arm === "treatment") ?? null;
  const visitors = experiment?.kind === "change"
    ? experiment.directional?.after.visitors ?? 0
    : (control?.visitors ?? 0) + (treatment?.visitors ?? 0);
  const status = experiment ? statusLabel(experiment.status) : "Suggested";
  const runningLook = !suggested && experiment != null;
  const names = armNames(experiment, signal);
  const checks = experiment
    ? launchChecks({
        kind: experiment.kind,
        mode: experiment.mode,
        hypothesis: experiment.hypothesis,
        metric: experiment.metric,
        guardrail: experiment.guardrail,
        control: experiment.control,
        treatment: experiment.treatment,
        page: experiment.page,
        estimateDays: experiment.estimate?.days ?? null,
        maxDays: maxExperimentDays(),
        evidenceCount: signal?.distinctEvidence ?? 0,
        sourceCount: signal?.sources.length ?? 0,
      })
    : [];
  const readyToLaunch = canLaunch(checks);
  const [scheduling, setScheduling] = useState(false);
  const decisions = (
    <Decisions
      experiment={experiment}
      signal={signal}
      busy={busy}
      readyToLaunch={readyToLaunch}
      onApprove={onApprove}
      onReject={onReject}
      onCancel={onCancel}
      onRollout={onRollout}
      onSchedule={() => setScheduling(true)}
      onStop={onStop}
      onApproveCleanup={onApproveCleanup}
      onDismissCleanup={onDismissCleanup}
      onStart={onStart}
      onDismissSignal={onDismissSignal}
      rating={rating}
      onRated={onRated}
    />
  );
  const panelWidth = useSyncExternalStore(subscribePanelWidth, readPanelWidth, () => DEFAULT_PANEL_WIDTH);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = panelWidth;
    const move = (moveEvent: PointerEvent) => writePanelWidth(startWidth + moveEvent.clientX - startX);
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
  }

  return (
    <div className="flex h-full min-h-0 bg-white text-[#1c1c1c]">
      <aside className="flex shrink-0 flex-col gap-4 overflow-auto px-4 py-4" style={{ width: panelWidth }}>
        <button type="button" onClick={onBack} className="text-left text-xs text-brand hover:underline">
          ‹ Dashboard
        </button>
        <div>
          <h1 className="text-xl leading-tight text-[#111827]">{title}</h1>
          <p className="mt-2 text-xs text-[#6b7280]">
            {experiment?.kind === "fix" ? "Fix" : experiment?.kind === "change" ? "Change" : experiment ? "A/B Test" : "Suggestion"}
            {experiment?.mode === "stochastic" ? " · varies each request" : ""} · <span className={status === "Running" || status === "Rolling out" ? "text-[#1f9d55]" : "text-[#374151]"}>{status}</span>
          </p>
          {suggested && (
            <p className="mt-2 inline-flex rounded border border-[#c7d7fe] bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
              Suggested
            </p>
          )}
        </div>
        <dl className="space-y-3 text-xs">
          <Fact label="Last publish" value={formatDay(experiment?.startedAt ?? experiment?.createdAt ?? signal?.updatedAt ?? null)} />
          {experiment?.status === "awaiting_approval" && experiment.kind !== "fix" && (
            <div className="space-y-1.5">
              <p className="font-medium text-[#111827]">Before this can launch</p>
              {checks.map((check) => (
                <p key={check.label} className={check.ok ? "text-[#17663a]" : "text-[#9f2d2d]"}>{check.ok ? "Yes. " : "Not yet. "}{check.label}</p>
              ))}
            </div>
          )}
          {experiment?.status === "rolling_out" && experiment.rollout && (
            <div className="space-y-1">
              <p className="font-medium text-[#111827]">Rollout</p>
              {experiment.rollout.map((phase, index) => (
                <p key={phase.at}>{index === 0 ? "Now" : formatDay(phase.at)} · {phase.pass}% see the new version</p>
              ))}
            </div>
          )}
          {experiment?.kind === "fix" ? (
            <Fact label="Ships" value={experiment.status === "rolled_out" ? "Everyone" : "Everyone, once you approve"} />
          ) : (
            <>
          <Fact label="Days running" value={daysRunning(experiment)} />
          <Fact label="Audiences" value="Everyone" />
          <Fact label="Experiment visitors" value={visitors ? visitors.toLocaleString("en-US") : "—"} />
          {experiment?.estimate && experiment.kind === "test" && (
            <div>
              <Fact label="Expected result" value={`~${experiment.estimate.days} days`} />
              <p className="mt-1 text-[11px] leading-4 text-[#9aa0a8]">
                {Math.round(experiment.estimate.weeklyVisitors).toLocaleString("en-US")} visitors a week, {(experiment.estimate.baselineRate * 100).toFixed(1)}% do this today, detects a {(experiment.estimate.relativeMde * 100).toFixed(0)}% change
              </p>
            </div>
          )}
            </>
          )}
        </dl>
        <Autonomous experiment={experiment} signal={signal} learning={learning} suggested={suggested} lastFailed={lastFailed} />
      </aside>
      <div
        role="separator"
        aria-label="Resize details panel"
        aria-orientation="vertical"
        aria-valuemin={280}
        aria-valuemax={600}
        aria-valuenow={panelWidth}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            writePanelWidth(panelWidth + (event.key === "ArrowLeft" ? -24 : 24));
          }
        }}
        className="group relative w-1.5 shrink-0 cursor-col-resize border-x border-transparent outline-none hover:bg-[#dbe7ff] focus:bg-[#dbe7ff]"
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#e6e8ec] group-hover:bg-brand group-focus:bg-brand" />
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        <MainPanel
          experiment={experiment}
          signal={signal}
          readout={readout}
          control={control}
          treatment={treatment}
          names={names}
          muted={!runningLook}
          showChart={runningLook}
          decisions={decisions}
        />
      </div>
      {experiment && (
        <RolloutScheduleDialog
          open={scheduling}
          busy={busy === experiment.id + "schedule"}
          onOpenChange={setScheduling}
          onSave={onSchedule}
        />
      )}
    </div>
  );
}

/** True when there is code to look at: a pull request, a pushed branch, or a stored draft. */
function hasCodeChange(experiment: Experiment | null): boolean {
  return Boolean(experiment && (experiment.prNumber || experiment.branch || experiment.draftPath));
}

/**
 * The results and the code change on one page, never in tabs. Before there are results the change
 * leads, because that is what the person is deciding on; once the experiment runs, results lead.
 * The decision buttons sit right above the code they act on.
 */
function MainPanel(props: {
  experiment: Experiment | null;
  signal: Signal | null;
  readout: Readout | null;
  control: ArmResult | null;
  treatment: ArmResult | null;
  names: { control: string; treatment: string };
  muted: boolean;
  showChart: boolean;
  decisions: React.ReactNode;
}) {
  const { experiment, decisions, ...results } = props;
  const hasChange = hasCodeChange(experiment);
  const hasResults = Boolean(
    experiment?.kind === "fix" || props.readout || experiment?.status === "running" || experiment?.status === "awaiting_rollout" || experiment?.status === "rolling_out" || experiment?.endedAt,
  );
  const change = experiment && hasChange ? (
    <section>
      <WhatChanges key={`summary-${experiment.id}`} experiment={experiment} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e8ec] px-4 py-3">
        <h2 className="text-sm font-medium text-[#111827]">Code change</h2>
        {decisions}
      </div>
      <CodeChange key={experiment.id} experiment={experiment} />
    </section>
  ) : null;

  if (change && !hasResults) {
    return (
      <div>
        {change}
        <p className="border-t border-[#e6e8ec] px-4 py-3 text-xs text-[#6b7280]">
          {experiment?.kind === "fix" ? "After merging, Kismet watches whether these complaints stop for 14 days." : "Results appear here once the experiment is live and counting visitors."}
        </p>
      </div>
    );
  }
  return (
    <div>
      {!change && decisions && <div className="flex justify-end border-b border-[#e6e8ec] px-4 py-3">{decisions}</div>}
      {experiment?.kind === "fix" ? <FixFollowUp experiment={experiment} signal={props.signal} /> : experiment?.kind === "change" ? <ChangeFollowUp experiment={experiment} /> : <ResultsCanvas experiment={experiment} {...results} />}
      {change && <div className="border-t border-[#e6e8ec]">{change}</div>}
    </div>
  );
}

function Autonomous({
  experiment,
  signal,
  learning,
  suggested,
  lastFailed,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  learning: Learning | null;
  suggested: boolean;
  lastFailed: Experiment | null;
}) {
  return (
    <div className="space-y-3 border-t border-[#e6e8ec] pt-3 text-xs">
      <p className="font-medium text-[#374151]">Kismet</p>
      {signal && (
        <div className="text-[#374151]">
          <p>
            {`Suggested from ${signal.evidence.length} ${signal.evidence.length === 1 ? "piece" : "pieces"} of evidence${signal.area ? ` in ${signal.area}` : ""}. ${signal.problem}`}
          </p>
          {signal.staleEvidence > 0 && <p className="mt-1">{signal.staleEvidence} older items not counted</p>}
        </div>
      )}
      {experiment?.hypothesis && <p>{experiment.hypothesis}</p>}
      {(experiment?.kind === "change" || experiment?.kind === "fix") && experiment.rationale && <ChangeRationaleBlock experiment={experiment} signal={signal} />}
      {experiment?.metric && <p className="text-[#374151]">{experiment.metric}</p>}
      {experiment?.guardrail && <p className="text-[#374151]">Guardrail: {experiment.guardrail}</p>}
      {!experiment && signal?.kind && signal.kindReason && (
        <p className="text-[#374151]">
          <span className="font-medium">Kismet thinks this is {signal.kind === "bug" ? "a bug" : "an idea"}:</span> {signal.kindReason}
        </p>
      )}
      {!experiment && lastFailed && (
        <p className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-red-700">
          Kismet&apos;s last attempt, &ldquo;{lastFailed.title}&rdquo;, did not finish. {lastFailed.note ?? "The build failed."}
        </p>
      )}
      {suggested && !experiment && (
        <p className="text-[#374151]">Approving this lets Kismet decide whether it is an experiment or a quick fix, then write the code.</p>
      )}
      {experiment?.status === "building" && (
        <p className="text-[#374151]">Kismet is writing the change. Approval waits until that pull request is ready.</p>
      )}
      {experiment?.overlap && <p className="text-[#374151]">{experiment.overlap}</p>}
      {experiment?.note && <p className="text-[#374151]">{experiment.note}</p>}
      {experiment?.readout?.verdict && experiment.readout.verdict !== "collecting" && (
        <p>Kismet calls this {experiment.readout.verdict}.</p>
      )}
      {learning && (
        <div className="rounded border border-[#e1e4e8] bg-[#f8fafc] p-2.5 text-[#374151]">
          <div className="flex items-center gap-2">
            <p className="font-medium">What Kismet learned</p>
            <LearningBadge outcome={learning.outcome} />
          </div>
          <p className="mt-1 leading-5">{learning.learning}</p>
        </div>
      )}
      {experiment?.status === "building" && experiment.coderSessionId && <BuildLive experimentId={experiment.id} />}
      <Links experiment={experiment} />
    </div>
  );
}

function LearningBadge({ outcome }: { outcome: Learning["outcome"] }) {
  const styles = outcome === "won" ? "border-green-200 bg-green-50 text-green-700"
    : outcome === "lost" ? "border-red-200 bg-red-50 text-red-700"
      : outcome === "rejected" ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[#d5d8de] bg-white text-[#6b7280]";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${styles}`}>{outcome}</span>;
}

function ChangeRationaleBlock({ experiment, signal }: { experiment: Experiment; signal: Signal | null }) {
  const [copied, setCopied] = useState(false);
  const rationale = experiment.rationale;
  if (!rationale) return null;
  return (
    <div className="space-y-2 rounded border border-[#dbe7ff] bg-[#f8fbff] p-3 text-[#374151]">
      <p className="font-medium text-[#111827]">{experiment.kind === "fix" ? "Why Kismet thinks this is a bug" : "Why Kismet thinks this helps"}</p>
      <p className="leading-5">{rationale.reasoning}</p>
      <ul className="space-y-1">
        {rationale.evidence.map((item, index) => {
          const author = signal?.evidence.find((evidence) => evidence.source === item.source && `${evidence.title} ${evidence.body}`.toLowerCase().includes(item.quote.toLowerCase().slice(0, 40)))?.author;
          return <li key={`${item.source}-${index}`}>“{item.quote}” <span className="text-[#6b7280]">— {item.source}{author ? ` · ${author}` : ""}</span></li>;
        })}
      </ul>
      <p><span className="font-medium">Confidence: {rationale.confidence === "high" ? "High" : "Medium"}</span> — {rationale.confidenceReason}</p>
      <p><span className="font-medium">What could go wrong:</span> {rationale.risks}</p>
      {rationale.question && (
        <div className="rounded border border-[#e1e4e8] bg-white p-2">
          <p><span className="font-medium">Ask your users:</span> “{rationale.question}”</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => {
            void navigator.clipboard.writeText(rationale.question ?? "").then(() => setCopied(true));
          }}>{copied ? "Copied" : "Copy"}</Button>
        </div>
      )}
    </div>
  );
}

function Decisions({
  experiment,
  signal,
  busy,
  readyToLaunch,
  onApprove,
  onReject,
  onCancel,
  onRollout,
  onSchedule,
  onStop,
  onApproveCleanup,
  onDismissCleanup,
  onStart,
  onDismissSignal,
  rating,
  onRated,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  busy: string | null;
  readyToLaunch: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRollout: () => void;
  onSchedule: () => void;
  onStop: () => void;
  onApproveCleanup: () => void;
  onDismissCleanup: () => void;
  onStart: () => void;
  onDismissSignal: () => void;
  rating: SuggestionRating | null;
  onRated: () => void;
}) {
  const id = experiment?.id ?? signal?.id ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2 empty:hidden">
        {!experiment && signal && (
          <>
            <Button size="sm" className="bg-[#111] text-white hover:bg-[#2a2a2a]" onClick={onStart} disabled={busy !== null}>
              {busy === signal.id && <Loader2 className="animate-spin" />}
              Approve suggestion
            </Button>
            <Button size="sm" variant="outline" onClick={onDismissSignal} disabled={busy !== null}>
              Dismiss
            </Button>
          </>
        )}
        {experiment?.status === "awaiting_approval" && (
          <>
            <Button size="sm" className="bg-[#111] text-white hover:bg-[#2a2a2a]" onClick={onApprove} disabled={busy !== null || (experiment.kind !== "fix" && !readyToLaunch)}>
              {busy === id + "approve" && <Loader2 className="animate-spin" />}
              {experiment.kind === "fix" ? "Approve & merge" : experiment.kind === "change" ? "Approve & ship to everyone" : "Approve & ship"}
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy !== null}>
              {experiment.kind === "fix" ? "Discard fix" : "Discard change"}
            </Button>
          </>
        )}
        {experiment?.status === "building" && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy !== null}>
            Stop and discard
          </Button>
        )}
        {(experiment?.status === "awaiting_rollout" || experiment?.status === "rolling_out") && (
          <>
            <Button size="sm" className="bg-[#111] text-white hover:bg-[#2a2a2a]" onClick={onSchedule} disabled={busy !== null}>
              Schedule rollout
            </Button>
            <Button size="sm" variant="outline" onClick={onRollout} disabled={busy !== null}>
              Ship to everyone now
            </Button>
            <Button size="sm" variant="outline" onClick={onStop} disabled={busy !== null}>
              Turn off
            </Button>
          </>
        )}
        {experiment?.status === "running" && (
          <Button size="sm" variant="outline" onClick={onStop} disabled={busy !== null}>
            Turn off
          </Button>
        )}
        {experiment?.cleanup?.status === "awaiting" && (
          <>
            <Button size="sm" onClick={onApproveCleanup} disabled={busy !== null}>
              Approve cleanup
            </Button>
            <Button size="sm" variant="outline" onClick={onDismissCleanup} disabled={busy !== null}>
              Keep the switch
            </Button>
          </>
        )}
        {(!experiment || experiment.status === "building" || experiment.status === "awaiting_approval") && signal && (
          <RatingControls key={experiment?.id ?? signal.id} experiment={experiment} signal={signal} initialRating={rating} onRated={onRated} />
        )}
    </div>
  );
}

function RatingControls({
  experiment,
  signal,
  initialRating,
  onRated,
}: {
  experiment: Experiment | null;
  signal: Signal;
  initialRating: SuggestionRating | null;
  onRated: () => void;
}) {
  const [rating, setRating] = useState(initialRating);
  const [askingReason, setAskingReason] = useState(false);
  const [reason, setReason] = useState(initialRating?.rating === "not_useful" ? initialRating.reason ?? "" : "");
  const [saving, setSaving] = useState(false);
  async function save(value: "good" | "not_useful") {
    setSaving(true);
    try {
      const response = await fetch("/api/autopilot/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetKind: experiment ? "experiment" : "signal",
          targetId: experiment?.id ?? signal.id,
          rating: value,
          ...(value === "not_useful" && reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { rating: SuggestionRating };
      setRating(body.rating);
      setAskingReason(false);
      onRated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-l border-[#e1e4e8] pl-2">
      <button type="button" aria-pressed={rating?.rating === "good"} disabled={saving} onClick={() => void save("good")} className={`rounded border px-2 py-1 text-xs ${rating?.rating === "good" ? "border-brand bg-[#eef4ff] text-brand" : "border-[#d5d8de] text-[#374151]"}`}>Good idea</button>
      <button type="button" aria-pressed={rating?.rating === "not_useful"} disabled={saving} onClick={() => setAskingReason(true)} className={`rounded border px-2 py-1 text-xs ${rating?.rating === "not_useful" ? "border-brand bg-[#eef4ff] text-brand" : "border-[#d5d8de] text-[#374151]"}`}>Not useful</button>
      {askingReason && (
        <form className="flex items-center gap-1.5" onSubmit={(event) => { event.preventDefault(); void save("not_useful"); }}>
          <label className="sr-only" htmlFor="rating-reason">Why is this not useful? (optional)</label>
          <input id="rating-reason" autoFocus maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why? (optional)" className="h-7 w-44 rounded border border-[#d5d8de] px-2 text-xs" />
          <button type="submit" disabled={saving} className="rounded border border-[#d5d8de] px-2 py-1 text-xs">Save</button>
        </form>
      )}
    </div>
  );
}

function Links({ experiment }: { experiment: Experiment | null }) {
  if (!experiment) return null;
  const cleanup = experiment.cleanup;
  return (
    <div className="space-y-1 text-brand">
      {experiment.buildUrl && (
        <a className="flex items-center gap-1 hover:underline" href={experiment.buildUrl} target="_blank" rel="noreferrer">
          Watch the build <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {experiment.prUrl && (
        <a className="flex items-center gap-1 hover:underline" href={experiment.prUrl} target="_blank" rel="noreferrer">
          Pull request #{experiment.prNumber} <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {cleanup?.status === "awaiting" && cleanup.prUrl && (
        <a className="flex items-center gap-1 hover:underline" href={cleanup.prUrl} target="_blank" rel="noreferrer">
          Cleanup pull request #{cleanup.prNumber} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function ChangeFollowUp({ experiment }: { experiment: Experiment }) {
  const result = experiment.directional;
  const rate = (count: { visitors: number; conversions: number }) => count.visitors ? count.conversions / count.visitors : null;
  const display = (value: number | null) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
  return (
    <section className="px-4 py-5 text-[#374151]">
      <div className="rounded border border-[#e1e4e8] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-[#111827]">Follow-up</h2>
          {result && <span className="rounded border border-[#d5d8de] bg-[#f8fafc] px-2 py-0.5 text-xs text-[#6b7280]">Directional, not proven</span>}
        </div>
        {!result ? (
          <p className="mt-3 text-sm">Ships to everyone behind a switch; Kismet checks the before/after for {experiment.metric} after 14 days.</p>
        ) : (
          <div className="mt-4 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded bg-[#f8fafc] p-3"><p className="text-xs text-[#6b7280]">14 days before</p><p className="mt-1 text-2xl font-medium">{display(rate(result.before))}</p><p className="text-xs text-[#6b7280]">{result.before.conversions} conversions · {result.before.visitors} visitors</p></div>
            <div className="rounded bg-[#f8fafc] p-3"><p className="text-xs text-[#6b7280]">After shipping</p><p className="mt-1 text-2xl font-medium">{display(rate(result.after))}</p><p className="text-xs text-[#6b7280]">{result.after.conversions} conversions · {result.after.visitors} visitors</p></div>
          </div>
        )}
      </div>
    </section>
  );
}

function FixFollowUp({ experiment, signal }: { experiment: Experiment; signal: Signal | null }) {
  const complaints = experiment.startedAt
    ? signal?.evidence.filter((item) => item.source !== "analytics" && Date.parse(item.occurredAt) > Date.parse(experiment.startedAt!)).length ?? 0
    : 0;
  return (
    <section className="px-4 py-5 text-[#374151]">
      <div className="rounded border border-[#e1e4e8] p-4">
        <h2 className="text-sm font-medium text-[#111827]">Follow-up</h2>
        {experiment.verifiedAt ? (
          <p className="mt-3 text-sm">{experiment.note}</p>
        ) : experiment.startedAt ? (
          <p className="mt-3 text-sm">Watching since {formatDay(experiment.startedAt)}: {complaints} new complaint{complaints === 1 ? "" : "s"} so far.</p>
        ) : (
          <p className="mt-3 text-sm">After merging, Kismet watches whether these complaints stop for 14 days.</p>
        )}
      </div>
    </section>
  );
}

function ResultsCanvas({
  experiment,
  signal,
  readout,
  control,
  treatment,
  names,
  muted,
  showChart,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  readout: Readout | null;
  control: ArmResult | null;
  treatment: ArmResult | null;
  names: { control: string; treatment: string };
  muted: boolean;
  showChart: boolean;
}) {
  const compare = control && treatment ? rateInterval(control, treatment) : null;
  const start = experiment?.startedAt ?? experiment?.createdAt ?? signal?.createdAt ?? null;
  return (
    <div className="text-[#374151]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-[#e6e8ec] px-4 py-3 text-xs text-[#6b7280]">
        <ToolbarLabel label="Date range" value={rangeLabel(start)} />
        <ToolbarLabel label="Segment" value="All visitors" />
        <ToolbarLabel label="Baseline" value={names.control} />
        <ToolbarLabel label="Metric" value={experiment?.metric || "Conversion"} />
        {muted && <span className="ml-auto text-[11px]">Results stay hidden until this suggestion is approved.</span>}
      </div>
      <div className="px-4 py-4">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-xs text-[#6b7280]">
              <th className="pb-2 font-medium" />
              <th className="pb-2 font-medium">Total conversions</th>
              <th className="pb-2 font-medium">Conversions per visitor</th>
              <th className="pb-2 font-medium">Improvement</th>
              <th className="pb-2 font-medium">Confidence interval</th>
              <th className="pb-2 text-right font-medium">Statistical significance</th>
            </tr>
          </thead>
          <tbody>
            <ResultRow
              name={names.control}
              color="#5c6570"
              arm={control}
              improvement={null}
              interval={null}
              significance="Baseline"
              remaining={null}
            />
            <ResultRow
              name={names.treatment}
              color="#db2777"
              arm={treatment}
              improvement={compare?.lift ?? readout?.lift ?? null}
              interval={compare}
              significance={significanceLabel(readout?.sequentialP ?? null)}
              remaining={treatment ? Math.max(0, (experiment?.estimate?.perArm ?? DECISION_VISITORS) - treatment.visitors) : null}
            />
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-[#9aa0a8]">
          Peeking-safe: checking early won&apos;t create false winners. Decisions wait at least {readout?.minimumDays ?? 7} days.
        </p>
        {readout?.srm && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            The visitor split looks broken ({readout.srm.observed[0].toLocaleString("en-US")} vs {readout.srm.observed[1].toLocaleString("en-US")}, expected about even). Results are paused until it&apos;s fixed.
          </div>
        )}
        {readout?.guardrail && (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-4 border-t border-[#eef0f3] pt-3 text-xs">
            <span className="font-medium">{experiment?.guardrail || "Guardrail"}</span>
            <span className="tabular-nums">{displayRate(readout.guardrail.control.rate)}</span>
            <span className="tabular-nums">{displayRate(readout.guardrail.treatment.rate)}</span>
            <span className={readout.guardrail.worse ? "font-medium text-red-700" : "font-medium text-green-700"}>
              {readout.guardrail.worse ? "Worse" : "OK"}
            </span>
          </div>
        )}
        {readout && readout.syntheticShare > 0 && (
          <p className="mt-2 text-xs text-[#6b7280]">{Math.round(readout.syntheticShare * 100)}% of this traffic is synthetic.</p>
        )}
      </div>
      {showChart && experiment && <VisitorChart experimentId={experiment.id} startedAt={experiment.startedAt} names={names} />}
      {muted && (
        <div className="mx-4 mb-6 rounded border border-dashed border-[#e1e4e8] px-4 py-8 text-center text-sm">
          Kismet will start counting visitors after you approve this experiment.
        </div>
      )}
    </div>
  );
}

function ResultRow({
  name,
  color,
  arm,
  improvement,
  interval,
  significance,
  remaining,
}: {
  name: string;
  color: string;
  arm: ArmResult | null;
  improvement: number | null;
  interval: { low: number; high: number; lift: number } | null;
  significance: string;
  remaining: number | null;
}) {
  const rate = arm && arm.visitors > 0 ? arm.conversions / arm.visitors : null;
  return (
    <tr className="border-t border-[#eef0f3]">
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="font-medium">{name}</span>
        </span>
      </td>
      <td className="py-3">
        <div>{arm ? arm.conversions.toLocaleString("en-US") : "—"}</div>
        <div className="text-xs text-[#9aa0a8]">{arm ? `${arm.visitors.toLocaleString("en-US")} visitors` : ""}</div>
      </td>
      <td className="py-3 tabular-nums">{rate == null ? "—" : rate.toFixed(3)}</td>
      <td className="py-3 tabular-nums">{improvement == null ? "—" : signedPercent(improvement)}</td>
      <td className="py-3">{interval ? <IntervalMark lift={interval.lift} low={interval.low} high={interval.high} /> : "—"}</td>
      <td className="py-3 text-right">
        <div>{significance}</div>
        {remaining != null && remaining > 0 && significance !== "Baseline" && (
          <div className="text-xs text-[#9aa0a8]">{remaining.toLocaleString("en-US")} visitors remaining</div>
        )}
      </td>
    </tr>
  );
}

function IntervalMark({ lift, low, high }: { lift: number; low: number; high: number }) {
  const bound = Math.max(Math.abs(low), Math.abs(high), Math.abs(lift), 0.01) * 1.4;
  const place = (value: number) => `${Math.min(98, Math.max(2, ((value + bound) / (2 * bound)) * 100))}%`;
  const left = place(Math.min(low, high));
  const right = place(Math.max(low, high));
  return (
    <div className="relative h-4 w-24" aria-label={`Confidence interval ${signedPercent(low)} to ${signedPercent(high)}`}>
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-[#e6e8ec]" />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#3cb043]" style={{ left, width: `max(8px, calc(${right} - ${left}))` }} />
      <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#3cb043] bg-white" style={{ left: place(lift) }} />
    </div>
  );
}

function VisitorChart({
  experimentId,
  startedAt,
  names,
}: {
  experimentId: string;
  startedAt: string | null;
  names: { control: string; treatment: string };
}) {
  const [points, setPoints] = useState<DailyVisitors[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/autopilot/experiments/${experimentId}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => (await res.json().catch(() => ({}))) as { series?: DailyVisitors[] })
      .then((body) => setPoints(fillDays(startedAt, body.series ?? [])))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPoints(fillDays(startedAt, []));
      });
    return () => controller.abort();
  }, [experimentId, startedAt]);

  return (
    <section className="border-t border-[#e6e8ec] px-4 py-3">
      <button type="button" className="mb-3 text-xs text-brand" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide graph" : "Show graph"}
      </button>
      {open && (
        <>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1 font-medium">
              Visitors over time
            </span>
            <span className="flex items-center gap-4 text-xs text-[#6b7280]">
              <Legend color="#5c6570" label={names.control} />
              <Legend color="#db2777" label={names.treatment} />
            </span>
          </div>
          {points == null ? (
            <p className="py-8 text-sm text-[#6b7280]">Loading visitors…</p>
          ) : (
            <VisitorLines points={points} />
          )}
        </>
      )}
    </section>
  );
}

function VisitorLines({ points }: { points: DailyVisitors[] }) {
  const width = 720;
  const height = 260;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = Math.max(1, ...points.flatMap((point) => [point.control, point.treatment]));
  const yMax = niceCeiling(max);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (index: number) => pad.l + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yAt = (value: number) => pad.t + (1 - value / yMax) * innerH;
  const path = (key: "control" | "treatment") =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(point[key]).toFixed(1)}`).join(" ");
  const ticks = [0, yMax / 2, yMax];
  const labelAt = (index: number) => points[index]?.day.slice(5).replace("-", "/");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Visitors over time">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} stroke="#e6e8ec" />
          <text x={pad.l - 8} y={yAt(tick) + 3} textAnchor="end" fill="#9aa0a8" fontSize="11">
            {tickLabel(tick)}
          </text>
        </g>
      ))}
      {points.length > 0 && (
        <>
          <path d={path("control")} fill="none" stroke="#5c6570" strokeWidth="1.5" />
          <path d={path("treatment")} fill="none" stroke="#db2777" strokeWidth="1.5" />
          <text x={xAt(0)} y={height - 8} fill="#9aa0a8" fontSize="11">
            {labelAt(0)}
          </text>
          {points.length > 2 && (
            <text x={xAt(Math.floor(points.length / 2))} y={height - 8} textAnchor="middle" fill="#9aa0a8" fontSize="11">
              {labelAt(Math.floor(points.length / 2))}
            </text>
          )}
          <text x={xAt(points.length - 1)} y={height - 8} textAnchor="end" fill="#9aa0a8" fontSize="11">
            {labelAt(points.length - 1)}
          </text>
        </>
      )}
    </svg>
  );
}

/** A fact about how results are counted. Not a menu: each has one value today, so it reads as plain text. */
function ToolbarLabel({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1" title={`${label}: ${value}`}>
      <span>{label}</span>
      <span className="max-w-56 truncate text-[#1c1c1c]">{value}</span>
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#9aa0a8]">{label}</dt>
      <dd className="mt-0.5 text-[#1c1c1c]">{value}</dd>
    </div>
  );
}

function armNames(experiment: Experiment | null, signal: Signal | null): { control: string; treatment: string } {
  const base = slug(experiment?.title || signal?.title || "experiment");
  return {
    control: slug(experiment?.control || "") || `${base}_current`,
    treatment: slug(experiment?.treatment || "") || `${base}_new`,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

function statusLabel(status: Experiment["status"]): string {
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  if (status === "building") return "Writing";
  if (status === "awaiting_approval") return "Suggested";
  if (status === "awaiting_rollout") return "Won";
  if (status === "rolling_out") return "Rolling out";
  if (status === "rolled_out") return "Rolled out";
  if (status === "stopped") return "Stopped";
  if (status === "rejected") return "Rejected";
  return "Failed";
}

function formatDay(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysRunning(experiment: Experiment | null): string {
  const start = experiment?.startedAt;
  if (!start) return "—";
  const days = Math.max(1, Math.round((Date.now() - Date.parse(start)) / 86_400_000));
  return String(days);
}

function rangeLabel(start: string | null): string {
  if (!start) return "Not started";
  return `${formatDay(start)} – ${formatDay(new Date().toISOString())}`;
}

function signedPercent(value: number): string {
  const percent = value * 100;
  const text = `${Math.abs(percent).toFixed(2)}%`;
  if (percent > 0) return `+${text}`;
  if (percent < 0) return `-${text}`;
  return text;
}

function significanceLabel(pValue: number | null): string {
  if (pValue == null) return "—";
  return `${Math.max(0, Math.min(99, Math.round((1 - pValue) * 100)))}%`;
}

function displayRate(rate: number | null): string {
  return rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function rateInterval(control: ArmResult, treatment: ArmResult): { lift: number; low: number; high: number } | null {
  if (control.visitors === 0 || treatment.visitors === 0) return null;
  const base = control.conversions / control.visitors;
  const next = treatment.conversions / treatment.visitors;
  if (base === 0) return null;
  const se = Math.sqrt((base * (1 - base)) / control.visitors + (next * (1 - next)) / treatment.visitors);
  const diff = next - base;
  return { lift: diff / base, low: (diff - 1.96 * se) / base, high: (diff + 1.96 * se) / base };
}

function fillDays(startedAt: string | null, series: DailyVisitors[]): DailyVisitors[] {
  if (!startedAt) return series;
  const start = new Date(startedAt);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const known = new Map(series.map((point) => [point.day, point]));
  const points: DailyVisitors[] = [];
  for (let time = start.getTime(); time <= end.getTime() && points.length < 62; time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    points.push(known.get(day) ?? { day, control: 0, treatment: 0 });
  }
  return points.length ? points : series;
}

function tickLabel(value: number): string {
  if (value >= 100 || Number.isInteger(value)) return Math.round(value).toLocaleString("en-US");
  return value.toFixed(1);
}

function niceCeiling(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * power;
}
