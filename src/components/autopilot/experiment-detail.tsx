"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import { BuildLive } from "@/components/autopilot/build-live";
import { CodeChange } from "@/components/autopilot/code-change";
import { VersionCaption, WhatChanges } from "@/components/autopilot/what-changes";
import { useExperimentSummary, useVisitorSeries, type ExperimentActivity } from "@/components/autopilot/experiment-queries";
import { BuilderMenu, useAccountBuilder } from "@/components/autopilot/builder-menu";
import { RolloutScheduleDialog } from "@/components/autopilot/rollout-schedule";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/auth/use-account";
import { type Builder } from "@/lib/autopilot/builders";
import { canLaunch, launchChecks } from "@/lib/autopilot/launch";
import { voteTally } from "@/lib/autopilot/preferences";
import type { RolloutPhase } from "@/lib/autopilot/rollout-plan";
import { maxExperimentDays } from "@/lib/autopilot/thresholds";
import { ageLabel } from "@/lib/autopilot/work-sessions";
import type { Activity, ArmResult, ChangeRationale, Experiment, Learning, Readout, Signal, SuggestionRating } from "@/lib/autopilot/types";
import { initialsFor } from "@/lib/onboarding";
import { usePresence } from "@/components/workspace/live-sync";
import { PresenceAvatar } from "@/components/workspace/presence-avatar";
import { formatLocation, presenceHere, type PresenceEntry } from "@/lib/workspace/live-sync-core";

const DECISION_VISITORS = 200;
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
  ratings,
  activity,
  onRated,
  onSaveAdjustments,
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
  onStart: (builder: Builder) => void;
  onDismissSignal: () => void;
  ratings: SuggestionRating[];
  activity: Activity[];
  onRated: () => void;
  onSaveAdjustments: (adjustments: string) => Promise<void>;
}) {
  const title = experiment?.title ?? signal?.title ?? "Experiment";
  const presence = usePresence();
  const here = experiment ? presenceHere(presence, formatLocation("/experiments", experiment.id)) : [];
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
  const accountBuilder = useAccountBuilder();
  const [pickedWriter, setPickedWriter] = useState<Builder | null>(null);
  const writer = pickedWriter ?? accountBuilder;
  const facts = [
    ...(experiment?.kind === "fix" ? [{
      label: experiment.status === "rejected" && experiment.rejectedBy === "kismet" ? "Decision" : "Ships",
      value: experiment.status === "rejected" && experiment.rejectedBy === "kismet"
        ? "No change needed"
        : experiment.status === "rolled_out" ? "Everyone" : "Everyone, once you approve",
    }] : [{ label: "Audiences", value: "Everyone" }]),
    ...(!suggested ? [{ label: "Last publish", value: formatDay(experiment?.startedAt ?? experiment?.createdAt ?? null) }] : []),
    ...(!suggested && experiment?.kind !== "fix" ? [
      { label: "Days running", value: daysRunning(experiment) },
      { label: "Experiment visitors", value: visitors ? visitors.toLocaleString("en-US") : "—" },
    ] : []),
  ];
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
      onStart={() => onStart(writer)}
      onDismissSignal={onDismissSignal}
    />
  );
  return (
    <div className="h-full min-h-0 overflow-auto bg-white px-4 py-4 text-[#1c1c1c] [scrollbar-gutter:stable] sm:px-6">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="text-left text-xs text-brand hover:underline">
            ‹ Dashboard
          </button>
          {decisions}
        </div>
        <div>
          <h1 className="text-xl leading-tight text-[#111827]">{title}</h1>
          {here.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6b7280]">
              <span className="flex -space-x-1">{here.slice(0, 3).map((person) => <PresenceAvatar key={person.userId} person={person} />)}</span>
              <span>{here[0].name}{here.length === 1 ? " is here too" : ` and ${here.length - 1} ${here.length === 2 ? "other are" : "others are"} here too`}</span>
            </div>
          )}
          {experiment && showBuildProgress(experiment) && <BuildProgress experiment={experiment} />}
        </div>
        <ReviewBar
          experiment={experiment}
          signal={signal}
          status={status}
          writer={writer}
          ratings={ratings}
          activity={activity}
          presence={presence}
          onRated={onRated}
        />
        <EvidenceStrip signal={signal} rationale={experiment?.rationale ?? null} />
        {experiment && <ChangeLead experiment={experiment} />}
        {experiment?.status === "building" && experiment.coderSessionId && <BuildLive experimentId={experiment.id} />}
        {!experiment && signal && <BuilderMenu value={writer} onChange={setPickedWriter} />}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {facts.map((fact, index) => (
            <span key={fact.label} className="contents">
              {index > 0 && <span className="text-[#c4c8cf]">·</span>}
              <InlineFact label={fact.label} value={fact.value} />
            </span>
          ))}
          <InlineLinks experiment={experiment} />
        </div>
        <div className="space-y-3 text-xs">
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
          {experiment?.estimate && experiment.kind === "test" && (
            <div>
              <Fact label="Expected result" value={`~${experiment.estimate.days} days`} />
              <p className="mt-1 text-[11px] leading-4 text-[#9aa0a8]">
                {Math.round(experiment.estimate.weeklyVisitors).toLocaleString("en-US")} visitors a week, {(experiment.estimate.baselineRate * 100).toFixed(1)}% do this today, detects a {(experiment.estimate.relativeMde * 100).toFixed(0)}% change
              </p>
            </div>
          )}
        </div>
        <Autonomous experiment={experiment} signal={signal} learning={learning} suggested={suggested} lastFailed={lastFailed} />
        {(suggested || experiment?.adjustments) && (
          <AdjustmentNotes experiment={experiment} signal={signal} onSave={onSaveAdjustments} />
        )}
        <MainPanel
          experiment={experiment}
          signal={signal}
          readout={readout}
          control={control}
          treatment={treatment}
          names={names}
          suggested={suggested}
          showChart={runningLook}
        />
      </main>
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

function ChangeLead({ experiment }: { experiment: Experiment }) {
  const summaryQuery = useExperimentSummary(experiment);
  const summary = summaryQuery.data?.summary ?? null;
  if (summary?.kind === "behavior" && hasCodeChange(experiment)) {
    return (
      <section className="border-y border-[#e6e8ec] py-3">
        <h2 className="text-sm font-medium text-[#111827]">Code change</h2>
        <div className="mt-3"><CodeChange key={experiment.id} experiment={experiment} /></div>
        <div className="mt-3"><VersionCaption before={summary.before} after={summary.after} /></div>
      </section>
    );
  }
  return <WhatChanges key={`summary-${experiment.id}`} experiment={experiment} />;
}

function CodeSection({ experiment }: { experiment: Experiment }) {
  const summaryQuery = useExperimentSummary(experiment);
  if (summaryQuery.data?.summary?.kind === "behavior") return null;
  return <CodeChange key={experiment.id} experiment={experiment} />;
}

const AGENT_MARK: Record<Builder, string> = {
  kismet: "/kismet-mark.png",
  cursor: "/logos/cursor.svg",
  "claude-code": "/logos/claude.svg",
};

const AGENT_LABEL: Record<Builder, string> = {
  kismet: "Kismet",
  cursor: "Cursor",
  "claude-code": "Claude Code",
};

type Credit = { kind: "agent"; builder: Builder } | { kind: "person"; name: string; imageUrl: string };

function ReviewBar({
  experiment,
  signal,
  status,
  writer,
  ratings,
  activity,
  presence,
  onRated,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  status: string;
  writer: Builder;
  ratings: SuggestionRating[];
  activity: Activity[];
  presence: PresenceEntry[];
  onRated: () => void;
}) {
  const account = useAccount();
  const kind = experiment?.kind === "fix" ? "Fix" : experiment?.kind === "change" ? "Change" : experiment ? "A/B Test" : "Suggestion";
  const live = status === "Running" || status === "Rolling out";
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-y border-[#d5d8de] py-3">
      <p className="text-sm font-medium text-[#111827]">
        {kind}
        {experiment?.mode === "stochastic" ? <span className="font-normal text-[#6b7280]"> · varies each request</span> : null}
        <span className={live ? "font-normal text-[#1f9d55]" : "font-normal text-[#6b7280]"}> · {status}</span>
      </p>
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <CreditLine label="Written by" credit={{ kind: "agent", builder: experiment?.builder ?? experiment?.buildWith ?? writer }} />
          <CreditLine label="Suggested by" credit={suggesterCredit(signal, activity, presence, account?.name ?? "", account?.imageUrl ?? "")} />
        </div>
        <Votes ratings={ratings} experiment={experiment} signal={signal} onRated={onRated} />
      </div>
    </div>
  );
}

function suggesterCredit(signal: Signal | null, activity: Activity[], presence: PresenceEntry[], accountName: string, accountImage: string): Credit {
  const started = signal
    ? activity.find((item) => item.ref === signal.id && item.kind === "person" && item.message.includes("— by "))
    : undefined;
  const name = started?.message.split("— by ").pop()?.trim() ?? "";
  if (name && name !== "someone") {
    const watching = presence.find((person) => person.name === name);
    return { kind: "person", name, imageUrl: watching?.imageUrl || (accountName === name ? accountImage : "") };
  }
  return { kind: "agent", builder: "kismet" };
}

function CreditLine({ label, credit }: { label: string; credit: Credit }) {
  return (
    <p className="flex items-center justify-end gap-1.5 text-xs text-[#374151]">
      <span className="text-[#9aa0a8]">{label}</span>
      {credit.kind === "agent" ? (
        // Kismet's name stands on its own; other builders keep their logo so they're easy to tell apart.
        credit.builder === "kismet" ? null : <img src={AGENT_MARK[credit.builder]} alt="" className="h-3.5 w-3.5 object-contain" />
      ) : (
        <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-[#eef1f4] text-[8px] font-medium text-[#374151]">
          {credit.imageUrl ? <img src={credit.imageUrl} alt="" className="h-full w-full object-cover" /> : initialsFor(credit.name)}
        </span>
      )}
      <span className="font-medium text-[#111827]">{credit.kind === "agent" ? AGENT_LABEL[credit.builder] : credit.name}</span>
    </p>
  );
}

function Votes({ ratings, experiment, signal, onRated }: {
  ratings: SuggestionRating[];
  experiment: Experiment | null;
  signal: Signal | null;
  onRated: () => void;
}) {
  const account = useAccount();
  const voterId = account?.id || "local";
  const targetId = experiment?.id ?? signal?.id ?? "";
  const targetKind = experiment ? "experiment" : "signal";
  const fromProps = voteTally(ratings, voterId);
  const signature = ratings.map((rating) => `${rating.voterId}:${rating.rating}`).join("|");
  // An optimistic tally lasts until the ratings it was made against change.
  const [pending, setPendingState] = useState<{ signature: string; tally: ReturnType<typeof voteTally> } | null>(null);
  const setPending = (tally: ReturnType<typeof voteTally> | null) => setPendingState(tally ? { signature, tally } : null);
  const [saving, setSaving] = useState(false);
  const view = pending && pending.signature === signature ? pending.tally : fromProps;
  if (!targetId) return null;

  async function vote(value: "good" | "not_useful") {
    setPending(nextTally(view, value));
    setSaving(true);
    try {
      const response = await fetch("/api/autopilot/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKind, targetId, rating: value }),
      });
      if (!response.ok) {
        setPending(null);
        return;
      }
      const body = (await response.json()) as { rating: SuggestionRating | null; good: number; notUseful: number };
      setPending({ good: body.good, notUseful: body.notUseful, mine: body.rating?.rating ?? null });
      onRated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1 border-l border-[#e6e8ec] pl-3">
      <VoteButton label="Like" pressed={view.mine === "good"} count={view.good} disabled={saving} onClick={() => void vote("good")}>
        <ThumbsUp className="h-3.5 w-3.5" />
      </VoteButton>
      <VoteButton label="Dislike" pressed={view.mine === "not_useful"} count={view.notUseful} disabled={saving} onClick={() => void vote("not_useful")}>
        <ThumbsDown className="h-3.5 w-3.5" />
      </VoteButton>
    </div>
  );
}

function nextTally(current: { good: number; notUseful: number; mine: "good" | "not_useful" | null }, value: "good" | "not_useful") {
  if (current.mine === value) {
    return {
      good: Math.max(0, current.good - (value === "good" ? 1 : 0)),
      notUseful: Math.max(0, current.notUseful - (value === "not_useful" ? 1 : 0)),
      mine: null as "good" | "not_useful" | null,
    };
  }
  let good = current.good;
  let notUseful = current.notUseful;
  if (current.mine === "good") good -= 1;
  if (current.mine === "not_useful") notUseful -= 1;
  if (value === "good") good += 1;
  else notUseful += 1;
  return { good: Math.max(0, good), notUseful: Math.max(0, notUseful), mine: value };
}

function VoteButton({ label, pressed, count, disabled, onClick, children }: {
  label: string;
  pressed: boolean;
  count: number;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs ${pressed ? "bg-[#eef4ff] text-brand" : "text-[#6b7280] hover:bg-[#f4f5f7] hover:text-[#111827]"}`}
    >
      {children}
      <span>{count}</span>
    </button>
  );
}

const SOURCE_MARK: Record<string, { src: string }> = {
  slack: { src: "/connectors/slack-color.svg" },
  ticket: { src: "/connectors/jira.svg" },
  analytics: { src: "/connectors/amplitude.png" },
  interview: { src: "" },
};

function EvidenceStrip({ signal, rationale }: { signal: Signal | null; rationale: ChangeRationale | null }) {
  const grouped = new Map<string, string[]>();
  const add = (source: string, text: string) => {
    const clipped = text.replace(/\s+/g, " ").trim();
    if (!clipped) return;
    const short = clipped.length > 88 ? `${clipped.slice(0, 85)}…` : clipped;
    const list = grouped.get(source) ?? [];
    if (list.length >= 2 || list.some((item) => item.toLowerCase() === short.toLowerCase())) return;
    list.push(short);
    grouped.set(source, list);
  };
  for (const item of signal?.evidence ?? []) add(item.source, item.title || item.body);
  for (const item of rationale?.evidence ?? []) add(item.source, item.quote);
  const groups = [...grouped.entries()];
  if (!groups.length) return null;
  return (
    <section>
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-[#9aa0a8]">Evidence</h2>
      <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1.5">
        {groups.map(([source, items]) => (
          <div key={source} className="flex min-w-0 items-start gap-1.5">
            {SOURCE_MARK[source]?.src ? (
              <img src={SOURCE_MARK[source].src} alt="" className="mt-0.5 h-3.5 w-3.5 shrink-0 object-contain" />
            ) : (
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
            )}
            <ul className="min-w-0 text-[11px] leading-4 text-[#374151]">
              {items.map((text) => <li key={text} className="max-w-xs truncate">• {text}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdjustmentNotes({
  experiment,
  signal,
  onSave,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  onSave: (adjustments: string) => Promise<void>;
}) {
  const saved = experiment?.adjustments ?? signal?.adjustments ?? "";
  const editable = !experiment || (
    experiment.status === "building" && !experiment.buildStartedAt && !experiment.coderSessionId && !experiment.buildRef && !experiment.draftPath
  );
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!editable) {
    return saved ? <p className="border-t border-[#e6e8ec] pt-3 text-xs text-[#374151]"><span className="font-medium">Your notes:</span> {saved}</p> : null;
  }

  return (
    <div className="space-y-1.5 border-t border-[#e6e8ec] pt-3 text-xs">
      <p className="font-medium text-[#111827]">Notes for the build <span className="font-normal text-[#9aa0a8]">· optional</span></p>
      <textarea
        value={value}
        onChange={(event) => { setValue(event.target.value); setMessage(""); }}
        maxLength={2000}
        rows={3}
        placeholder="Anything to change before Kismet builds this? e.g. use the existing Button, keep the copy shorter"
        className="w-full resize-y rounded border border-[#d5d8de] bg-white px-2.5 py-2 leading-5 text-[#111827] outline-none placeholder:text-[#9aa0a8] focus:border-brand"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || value.trim() === saved}
          className="text-brand hover:underline disabled:text-[#9aa0a8] disabled:no-underline"
          onClick={() => {
            setSaving(true);
            setMessage("");
            void onSave(value).then(() => setMessage("Saved")).catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : "Could not save your notes.");
            }).finally(() => setSaving(false));
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message && <span className="text-[#6b7280]">{message}</span>}
      </div>
    </div>
  );
}

function BuildProgress({ experiment }: { experiment: Experiment }) {
  const stages = [
    { stage: "reading", label: "Reading" },
    { stage: "writing", label: "Writing" },
    { stage: "checking", label: "Checks" },
    { stage: "pushing", label: "Pushing" },
    { stage: "opening_pr", label: "PR" },
    { stage: "preview", label: "Preview build" },
  ] as const;
  const current = experiment.status === "awaiting_approval"
    ? "preview"
    : experiment.buildStage === "starting" ? "reading" : experiment.buildStage;
  const currentIndex = stages.findIndex((item) => item.stage === current);
  const since = experiment.status === "awaiting_approval"
    ? null
    : ageLabel(experiment.buildStageAt ?? experiment.buildStartedAt ?? experiment.createdAt);
  return (
    <div className="mt-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-[#6b7280]">
      {stages.map((item, index) => (
        <span key={item.stage} className="contents">
          {index > 0 && <span className="text-[#c4c8cf]">→</span>}
          <span className={index < currentIndex ? "text-[#17663a]" : index === currentIndex ? "font-medium text-[#111827]" : "text-[#9aa0a8]"}>
            {index < currentIndex ? "✓ " : ""}{item.label}
          </span>
        </span>
      ))}
      {since && <span className="ml-1 text-[#9aa0a8]">· last activity {since} ago</span>}
    </div>
  );
}

/** While the agent works, and after its PR opens until the preview build finishes. */
function showBuildProgress(experiment: Experiment): boolean {
  if (experiment.status === "building") return Boolean(experiment.buildStage);
  return experiment.status === "awaiting_approval" && Boolean(experiment.buildStage) &&
    (experiment.note ?? "").includes("Waiting for the preview build");
}

/** True when there is code to look at: a pull request, a pushed branch, or a stored draft. */
function hasCodeChange(experiment: Experiment | null): boolean {
  return Boolean(experiment && (experiment.prNumber || experiment.branch || experiment.draftPath));
}

/** The substantive sections share the page's single reading column. */
function MainPanel(props: {
  experiment: Experiment | null;
  signal: Signal | null;
  readout: Readout | null;
  control: ArmResult | null;
  treatment: ArmResult | null;
  names: { control: string; treatment: string };
  suggested: boolean;
  showChart: boolean;
}) {
  const { experiment, suggested, ...results } = props;
  const hasChange = hasCodeChange(experiment);
  const hasResults = Boolean(
    experiment?.kind === "fix" || props.readout || experiment?.status === "running" || experiment?.status === "awaiting_rollout" || experiment?.status === "rolling_out" || experiment?.endedAt,
  );
  return (
    <div className="space-y-4">
      {hasResults && experiment?.kind !== "fix" && (experiment?.kind === "change" ? <ChangeFollowUp experiment={experiment} /> : <ResultsCanvas experiment={experiment} {...results} />)}
      {!hasResults && suggested && <NotPublishedYet />}
      {experiment && hasChange && <CodeSection experiment={experiment} />}
      {experiment && !hasResults && !suggested && (
        <p className="border-t border-[#e6e8ec] pt-3 text-xs text-[#6b7280]">Results appear here once the experiment is live and counting visitors.</p>
      )}
      {experiment?.kind === "fix" && <FixFollowUp experiment={experiment} signal={props.signal} className="border-t border-[#e6e8ec] pt-3" />}
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
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-3 border-t border-[#e6e8ec] pt-3 text-xs">
      <p className="font-medium text-[#374151]">Notes</p>
      <div className={expanded ? "space-y-3" : "space-y-3 overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]"}>
      {signal?.problem && <p className="text-[#374151]">{signal.problem}</p>}
      {signal && signal.staleEvidence > 0 && <p className="text-[#374151]">{signal.staleEvidence} older items not counted</p>}
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
      </div>
      <button type="button" className="text-brand hover:underline" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Show less" : "Show more"}
      </button>
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
    </div>
  );
}

function InlineLinks({ experiment }: { experiment: Experiment | null }) {
  if (!experiment) return null;
  const cleanup = experiment.cleanup;
  return (
    <>
      {experiment.startedAt && (
        <><span className="text-[#c4c8cf]">·</span><a className="text-brand hover:underline" href={`/analytics?experiment=${encodeURIComponent(experiment.id)}`}>
          See in Analytics →
        </a></>
      )}
      {experiment.buildUrl && (
        <><span className="text-[#c4c8cf]">·</span><a className="inline-flex items-center gap-1 text-brand hover:underline" href={experiment.buildUrl} target="_blank" rel="noreferrer">
          Watch the build <ExternalLink className="h-3 w-3" />
        </a></>
      )}
      {experiment.prUrl && (
        <><span className="text-[#c4c8cf]">·</span><a className="inline-flex items-center gap-1 text-brand hover:underline" href={experiment.prUrl} target="_blank" rel="noreferrer">
          Pull request #{experiment.prNumber} <ExternalLink className="h-3 w-3" />
        </a></>
      )}
      {cleanup?.status === "awaiting" && cleanup.prUrl && (
        <><span className="text-[#c4c8cf]">·</span><a className="inline-flex items-center gap-1 text-brand hover:underline" href={cleanup.prUrl} target="_blank" rel="noreferrer">
          Cleanup pull request #{cleanup.prNumber} <ExternalLink className="h-3 w-3" />
        </a></>
      )}
    </>
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

function FixFollowUp({ experiment, signal, className = "border-b border-[#e6e8ec] px-4 py-3" }: { experiment: Experiment; signal: Signal | null; className?: string }) {
  const complaints = experiment.startedAt
    ? signal?.evidence.filter((item) => item.source !== "analytics" && Date.parse(item.occurredAt) > Date.parse(experiment.startedAt!)).length ?? 0
    : 0;
  const text = experiment.status === "rejected" && experiment.rejectedBy === "kismet"
    ? experiment.note
    : experiment.verifiedAt
    ? experiment.note
    : experiment.startedAt
      ? `Watching since ${formatDay(experiment.startedAt)}: ${complaints} new complaint${complaints === 1 ? "" : "s"} so far.`
      : "After merging, Kismet watches whether these complaints stop for 14 days.";
  return (
    <p className={`${className} text-xs text-[#6b7280]`}>
      <span className="font-medium text-[#111827]">Follow-up</span> · {text}
    </p>
  );
}

/** An unapproved suggestion has never been published, so there is nothing to measure yet. */
function NotPublishedYet() {
  return (
    <section className="px-4 py-5 text-[#374151]">
      <div className="rounded border border-dashed border-[#e1e4e8] px-4 py-8 text-center">
        <h2 className="text-sm font-medium text-[#111827]">Not approved or published yet</h2>
        <p className="mt-2 text-sm">This is a suggestion, not a live experiment. Kismet starts counting visitors and showing results after you approve it and it ships.</p>
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
  showChart,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  readout: Readout | null;
  control: ArmResult | null;
  treatment: ArmResult | null;
  names: { control: string; treatment: string };
  showChart: boolean;
}) {
  const live = useVisitorSeries(showChart ? experiment : null);
  const activity = live.data?.activity ?? null;
  const controlShown = activity ? liveArm(activity.totals.control, "control") : control;
  const treatmentShown = activity ? liveArm(activity.totals.treatment, "treatment") : treatment;
  const compare = controlShown && treatmentShown ? rateInterval(controlShown, treatmentShown) : null;
  const start = experiment?.startedAt ?? experiment?.createdAt ?? signal?.createdAt ?? null;
  return (
    <div className="text-[#374151]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-[#e6e8ec] px-4 py-3 text-xs text-[#6b7280]">
        <ToolbarLabel label="Date range" value={rangeLabel(start)} />
        <ToolbarLabel label="Segment" value={segmentLabel(activity)} />
        <ToolbarLabel label="Baseline" value={names.control} />
        <ToolbarLabel label="Metric" value={experiment?.metric || "Conversion"} />
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
              arm={controlShown}
              detail={activity?.totals.control ?? null}
              improvement={null}
              interval={null}
              significance="Baseline"
              remaining={null}
            />
            <ResultRow
              name={names.treatment}
              color="#db2777"
              arm={treatmentShown}
              detail={activity?.totals.treatment ?? null}
              improvement={compare?.lift ?? readout?.lift ?? null}
              interval={compare}
              significance={significanceLabel(readout?.sequentialP ?? null)}
              remaining={treatmentShown ? Math.max(0, (experiment?.estimate?.perArm ?? DECISION_VISITORS) - treatmentShown.visitors) : null}
            />
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-[#9aa0a8]">
          Counts refresh as people arrive. A winner is only called on Kismet&apos;s check, after at least {readout?.minimumDays ?? 7} days, so looking early cannot invent one.
        </p>
        {live.isError && (
          <p className="mt-2 text-xs text-red-700">Could not load live traffic. The last saved result is still shown.</p>
        )}
        {activity && activity.humanVisitors === 0 && activity.syntheticVisitors > 0 && (
          <p className="mt-2 text-xs text-[#6b7280]">No human visitors yet. These numbers are sample traffic, so they do not decide the experiment.</p>
        )}
        {activity && activity.humanVisitors > 0 && activity.syntheticVisitors > 0 && (
          <p className="mt-2 text-xs text-[#6b7280]">{activity.syntheticVisitors.toLocaleString("en-US")} automated or sample visits are left out. The counts are people.</p>
        )}
        {activity ? <VariantSplit activity={activity} names={names} /> : null}
        {activity?.uneven ? (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            The split is off: {activity.totals.control.visitors.toLocaleString("en-US")} people on {names.control} and {activity.totals.treatment.visitors.toLocaleString("en-US")} on {names.treatment}, against a {activity.treatmentPct}% plan for the new version.
          </div>
        ) : readout?.srm && (
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
        {!activity && readout && readout.syntheticShare > 0 && (
          <p className="mt-2 text-xs text-[#6b7280]">{Math.round(readout.syntheticShare * 100)}% of this traffic is synthetic.</p>
        )}
      </div>
      {showChart && experiment && (
        <VisitorChart
          experiment={experiment}
          names={names}
          loading={live.isLoading}
          refreshing={live.isFetching && !live.isPending}
          series={live.data?.series ?? []}
          activity={activity}
        />
      )}
    </div>
  );
}

function ResultRow({
  name,
  color,
  arm,
  detail,
  improvement,
  interval,
  significance,
  remaining,
}: {
  name: string;
  color: string;
  arm: ArmResult | null;
  detail: { views: number; clicks: number } | null;
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
        <div className="text-xs text-[#9aa0a8]">
          {arm ? `${arm.visitors.toLocaleString("en-US")} people` : ""}
          {detail ? ` · ${detail.views.toLocaleString("en-US")} viewed · ${detail.clicks.toLocaleString("en-US")} clicked` : ""}
        </div>
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

type TrendMetric = "visitors" | "views" | "clicks" | "conversions";

const TRENDS: { id: TrendMetric; label: string }[] = [
  { id: "visitors", label: "People" },
  { id: "views", label: "Page views" },
  { id: "clicks", label: "Clicks" },
  { id: "conversions", label: "Conversions" },
];

function VisitorChart({
  experiment,
  names,
  loading,
  refreshing,
  series,
  activity,
}: {
  experiment: Experiment;
  names: { control: string; treatment: string };
  loading: boolean;
  refreshing: boolean;
  series: DailyVisitors[];
  activity: ExperimentActivity | null;
}) {
  const [open, setOpen] = useState(true);
  const [metric, setMetric] = useState<TrendMetric>("visitors");
  const source = activity
    ? activity.days.map((point) => ({ day: point.day, control: point.control[metric], treatment: point.treatment[metric] }))
    : series;
  const points = loading ? null : fillDays(experiment.startedAt, source);
  const trend = TRENDS.find((item) => item.id === metric) ?? TRENDS[0];

  return (
    <section className="border-t border-[#e6e8ec] px-4 py-3">
      <button type="button" className="mb-3 text-xs text-brand" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide graph" : "Show graph"}
      </button>
      {open && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              {trend.label} over time
              {refreshing && <span className="text-xs font-normal text-[#9aa0a8]">Updating</span>}
            </span>
            <span className="flex items-center gap-4 text-xs text-[#6b7280]">
              <Legend color="#5c6570" label={names.control} />
              <Legend color="#db2777" label={names.treatment} />
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="What to chart">
            {TRENDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMetric(item.id)}
                className={`rounded px-2 py-1 text-xs ${metric === item.id ? "bg-[#111827] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]"}`}
                aria-pressed={metric === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          {points == null ? (
            <div className="min-h-64 animate-pulse rounded-md bg-[#f8f9fa] p-4" role="status">
              <span className="sr-only">Loading visitors…</span>
              <div className="h-full min-h-56 rounded border border-[#e6e8ec] bg-[#eceef1]" />
            </div>
          ) : (
            <div className="animate-in fade-in duration-150"><VisitorLines points={points} label={`${trend.label} over time`} /></div>
          )}
        </>
      )}
    </section>
  );
}

function VariantSplit({ activity, names }: { activity: ExperimentActivity; names: { control: string; treatment: string } }) {
  const control = activity.totals.control.visitors;
  const treatment = activity.totals.treatment.visitors;
  const scale = Math.max(control, treatment, 1);
  return (
    <div className="mt-4 border-t border-[#eef0f3] pt-3">
      <p className="text-xs font-medium text-[#111827]">People on each version</p>
      <p className="mt-1 text-xs text-[#6b7280]">{splitSentence(control, treatment, activity.treatmentPct, names.treatment)}</p>
      <div className="mt-3 space-y-2">
        <SplitBar label={names.control} count={control} width={(control / scale) * 100} color="#5c6570" />
        <SplitBar label={names.treatment} count={treatment} width={(treatment / scale) * 100} color="#db2777" />
      </div>
    </div>
  );
}

function SplitBar({ label, count, width, color }: { label: string; count: number; width: number; color: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
      <span className="truncate text-[#374151]">{label}</span>
      <span className="h-2 rounded-full bg-[#f3f4f6]">
        <span className="block h-2 rounded-full" style={{ width: `${Math.max(count > 0 ? 4 : 0, width)}%`, background: color }} />
      </span>
      <span className="tabular-nums text-[#111827]">{count.toLocaleString("en-US")}</span>
    </div>
  );
}

function liveArm(arm: ExperimentActivity["totals"]["control"], name: "control" | "treatment"): ArmResult {
  return { arm: name, visitors: arm.visitors, conversions: arm.conversions, rate: arm.visitors ? arm.conversions / arm.visitors : null };
}

function segmentLabel(activity: ExperimentActivity | null): string {
  if (!activity) return "All visitors";
  if (activity.humanVisitors === 0 && activity.syntheticVisitors > 0) return "Sample traffic";
  return "Human visitors";
}

function splitSentence(control: number, treatment: number, treatmentPct: number, treatmentName: string): string {
  const total = control + treatment;
  if (total === 0) return "No one has been counted yet. Open the site in a browser, then again in a private window. Each person shows up here within a few seconds.";
  const expected = Math.round((total * treatmentPct) / 100);
  const delta = treatment - expected;
  if (delta === 0) return `The split matches the plan: about ${treatmentPct}% see ${treatmentName}.`;
  const count = Math.abs(delta).toLocaleString("en-US");
  const people = Math.abs(delta) === 1 ? "person" : "people";
  return `${treatmentName} has ${count} ${delta > 0 ? "more" : "fewer"} ${people} than the ${treatmentPct}% plan.`;
}

function VisitorLines({ points, label }: { points: DailyVisitors[]; label: string }) {
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
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label={label}>
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

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[#9aa0a8]">{label}</span>
      <span className="text-[#1c1c1c]">{value}</span>
    </span>
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
