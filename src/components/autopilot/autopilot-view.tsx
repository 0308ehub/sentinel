"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  Loader2,
  MessageSquare,
  Play,
  Ticket,
  BarChart3,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BuildLive } from "@/components/autopilot/build-live";
import { RelativeTime } from "@/components/shared/relative-time";
import { cn } from "@/lib/utils";
import {
  READY_MIN_EVIDENCE,
  type AutopilotState,
  type Evidence,
  type EvidenceSource,
  type Experiment,
  type Signal,
} from "@/lib/autopilot/types";

const SOURCE_ICON: Record<EvidenceSource, typeof MessageSquare> = {
  slack: MessageSquare,
  ticket: Ticket,
  analytics: BarChart3,
  interview: Mic,
};

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  slack: "Slack",
  ticket: "Ticket",
  analytics: "Analytics",
  interview: "Interview",
};

const DONE = new Set(["rolled_out", "stopped", "rejected", "failed"]);

export function AutopilotView() {
  const [polling, setPolling] = useState(true);
  const query = useQuery({
    queryKey: ["autopilot"],
    queryFn: async () => {
      const res = await fetch("/api/autopilot", { cache: "no-store" });
      return (await res.json()) as AutopilotState;
    },
    refetchInterval: polling ? 15000 : false,
  });
  const state = query.data ?? null;
  const load = query.refetch;
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setPolling(false), 5 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, []);

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/autopilot/tick", { method: "POST" });
      const result = (await res.json()) as { steps?: string[]; errors?: string[] };
      const parts = [...(result.steps ?? []), ...(result.errors ?? [])];
      setMessage(parts.length ? parts.join(" ") : "Nothing new to do.");
      await load();
    } catch {
      setMessage("The run failed. Try again.");
    } finally {
      setRunning(false);
    }
  }

  async function removeSample() {
    if (!window.confirm("Remove all sample evidence, and the problems and unbuilt experiments that rest only on it?")) return;
    setBusy("sample");
    setMessage(null);
    try {
      const res = await fetch("/api/autopilot/sample-data", { method: "DELETE" });
      const body = (await res.json()) as { evidence?: number; signals?: number; experiments?: number; error?: string };
      setMessage(
        res.ok
          ? `Removed ${body.evidence ?? 0} pieces of sample evidence, ${body.signals ?? 0} problems and ${body.experiments ?? 0} experiments.`
          : body.error ?? "Could not remove the sample data."
      );
      await load();
    } catch {
      setMessage("Could not remove the sample data. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function testSignal(signal: Signal) {
    if (state?.experiments.some((experiment) => experiment.status === "building")) {
      setMessage("Kismet is already writing a change. It is listed under Running.");
      document.getElementById("autopilot-running")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setBusy(signal.id);
    setMessage("Designing the test. This usually takes under a minute.");
    try {
      const res = await fetch(`/api/autopilot/signals/${signal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      setMessage(body.message ?? body.error ?? "The test did not start.");
      await load();
      if (res.ok) document.getElementById("autopilot-running")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setMessage("Could not start a test. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function dismissSignal(signal: Signal) {
    setBusy(signal.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/autopilot/signals/${signal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      setMessage(body.message ?? body.error ?? null);
      await load();
    } catch {
      setMessage("Could not dismiss this problem. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function act(
    experiment: Experiment,
    action: "approve" | "reject" | "cancel" | "rollout" | "stop" | "approve-cleanup" | "dismiss-cleanup"
  ) {
    setBusy(experiment.id + action);
    setMessage(null);
    try {
      const res = await fetch(`/api/autopilot/experiments/${experiment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      setMessage(body.message ?? body.error ?? null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading experiments…
      </div>
    );
  }

  const needsYou = state.experiments.filter((e) => e.status === "awaiting_approval" || e.status === "awaiting_rollout");
  const finishing = state.experiments.filter((e) => e.cleanup?.status === "awaiting");
  const live = state.experiments.filter((e) => e.status === "running" || e.status === "queued" || e.status === "building");
  const history = state.experiments.filter((e) => DONE.has(e.status));
  const problems = state.signals.filter((s) => s.status !== "dismissed");
  const waitingForFirstResults = state.signals.length === 0 && state.experiments.length === 0;

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">Experiments</h1>
              <p className="text-sm text-muted-foreground">
                {state.repo ? (
                  <>This account ships to {state.repo}.</>
                ) : (
                  <>
                    No repository yet.{" "}
                    <a href="/settings/connectors/github" className="underline underline-offset-2">
                      Choose one in Settings → Connectors → GitHub
                    </a>{" "}
                    so Kismet can build experiments.
                  </>
                )}
              </p>
            </div>
            <Button onClick={runNow} disabled={running || !state.configured}>
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              Run now
            </Button>
          </div>

          {!state.configured || state.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {state.error ?? "Kismet needs a database. Set DATABASE_URL and restart."}
            </p>
          ) : (
            <p className="text-sm">
              This week: <strong>{state.summary.evidenceThisWeek}</strong> pieces of evidence
              {state.summary.evidenceThisWeek > 0 && state.summary.realThisWeek === 0 && " (all synthetic)"}
              {state.summary.realThisWeek > 0 && ` (${state.summary.realThisWeek} real)`}, {" "}
              <strong>{state.summary.readySignals}</strong> {state.summary.readySignals === 1 ? "problem" : "problems"} ready
              to test, <strong>{state.summary.running}</strong> {state.summary.running === 1 ? "experiment" : "experiments"} running.{" "}
              <span className="text-muted-foreground">
                {state.lastRunAt ? (
                  <>
                    Last ran <RelativeTime date={state.lastRunAt} />.
                  </>
                ) : (
                  "Hasn't run yet."
                )}
              </span>
            </p>
          )}

          {!state.synthetic && state.sampleEvidence > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm">
              <p className="text-muted-foreground">
                {state.sampleEvidence} pieces of sample evidence from before sample data was turned off are still here.
              </p>
              <Button variant="outline" size="sm" onClick={removeSample} disabled={busy === "sample"}>
                {busy === "sample" && <Loader2 className="animate-spin" />}
                Remove sample data
              </Button>
            </div>
          )}
          {state.dryRun && (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Dry run: Kismet writes changes but never pushes, merges or closes anything on GitHub.
            </p>
          )}
          {message && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{message}</p>}
        </header>

        {waitingForFirstResults ? (
          <section className="rounded-lg border border-border bg-muted/30 p-5">
            <h2 className="text-sm font-medium">Kismet is reading your evidence.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It runs every hour and will propose experiments here. So far, it has {state.summary.evidenceThisWeek}{" "}
              {state.summary.evidenceThisWeek === 1 ? "piece" : "pieces"} of evidence from this week.
            </p>
            <a href="/settings/connectors" className="mt-3 inline-block text-sm underline underline-offset-2">
              Add more sources
            </a>
          </section>
        ) : (
          <>
            <Section title="Needs you" count={needsYou.length + finishing.length} empty="Nothing needs you right now.">
          {needsYou.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              signal={state.signals.find((s) => s.id === experiment.signalId)}
              actions={
                experiment.status === "awaiting_approval" ? (
                  <>
                    <Button size="sm" onClick={() => act(experiment, "approve")} disabled={busy !== null}>
                      {busy === experiment.id + "approve" && <Loader2 className="animate-spin" />}
                      Approve &amp; ship
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(experiment, "reject")} disabled={busy !== null}>
                      {busy === experiment.id + "reject" && <Loader2 className="animate-spin" />}
                      Discard change
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => act(experiment, "rollout")} disabled={busy !== null}>
                      {busy === experiment.id + "rollout" && <Loader2 className="animate-spin" />}
                      Roll out to everyone
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(experiment, "stop")} disabled={busy !== null}>
                      Turn off
                    </Button>
                  </>
                )
              }
            />
          ))}
          {finishing.map((experiment) => (
            <CleanupCard
              key={experiment.id + "-cleanup"}
              experiment={experiment}
              busy={busy}
              onApprove={() => act(experiment, "approve-cleanup")}
              onDismiss={() => act(experiment, "dismiss-cleanup")}
            />
          ))}
            </Section>

            <div id="autopilot-running">
            <Section title="Running" count={live.length} empty="No experiments running.">
          {live.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              signal={state.signals.find((s) => s.id === experiment.signalId)}
              actions={experiment.status === "building" ? (
                <Button size="sm" variant="outline" onClick={() => act(experiment, "cancel")} disabled={busy !== null}>
                  {busy === experiment.id + "cancel" && <Loader2 className="animate-spin" />}
                  Stop and discard
                </Button>
              ) : undefined}
            />
          ))}
            </Section>
            </div>

            <Section
          title="What's not working"
          count={problems.length}
          empty={state.lastRunAt ? "No problems found yet." : "Press Run now to start collecting evidence."}
          note={
            problems.some((signal) => signal.status === "open" && !signal.ready)
              ? "Kismet starts a test on its own once a problem has 5 pieces of evidence. Test a fix starts one now."
              : undefined
          }
        >
          {message && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{message}</p>}
          {problems.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              experiment={state.experiments.find((item) => item.signalId === signal.id)}
              onDismiss={() => dismissSignal(signal)}
              onTest={() => testSignal(signal)}
              busy={busy === signal.id}
            />
          ))}
            </Section>

            {history.length > 0 && (
          <Section title="History" count={history.length}>
            {history.map((experiment) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                signal={state.signals.find((s) => s.id === experiment.signalId)}
              />
            ))}
          </Section>
            )}
          </>
        )}

        {state.activity.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">What Kismet did recently</summary>
            <ul className="mt-2 space-y-1">
              {state.activity
                .filter((a) => a.kind !== "tick")
                .map((a) => (
                  <li key={a.id} className={cn(a.kind === "error" && "text-destructive")}>
                    <RelativeTime date={a.at} className="mr-2 tabular-nums" />
                    {a.message}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>
    </ScrollArea>
  );
}

function Section({
  title,
  count,
  empty,
  note,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">{count}</span>
      </h2>
      {note && count > 0 && <p className="text-sm text-muted-foreground">{note}</p>}
      {count === 0 && empty ? <p className="text-sm text-muted-foreground">{empty}</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

const OPEN_TEST = new Set(["building", "queued", "running", "awaiting_approval", "awaiting_rollout"]);

function SignalCard({
  signal,
  experiment,
  onDismiss,
  onTest,
  busy,
}: {
  signal: Signal;
  experiment?: Experiment;
  onDismiss: () => void;
  onTest: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const synthetic = signal.evidence.filter((e) => e.synthetic).length;
  return (
    <div className="rounded-md border border-border">
      <div className="flex items-start">
      <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left hover:bg-muted/50">
        {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{signal.title}</p>
            {signal.status === "experimenting" ? (
              <Badge variant="default">Testing a fix</Badge>
            ) : signal.ready ? (
              <Badge variant="warning">Enough evidence</Badge>
            ) : (
              <Badge variant="muted">
                {signal.distinctEvidence}/{READY_MIN_EVIDENCE} evidence
              </Badge>
            )}
          </div>
          {signal.problem && <p className="mt-1 text-xs text-muted-foreground">{signal.problem}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {signal.evidence.length} {signal.evidence.length === 1 ? "piece" : "pieces"} from {signal.sources.map((s) => SOURCE_LABEL[s]).join(", ")}
            {signal.area && ` · ${signal.area}`}
            {synthetic > 0 && ` · ${synthetic === signal.evidence.length ? "all" : synthetic} synthetic`}
          </p>
          {experiment?.status === "building" && (
            <p className="mt-1 text-xs text-muted-foreground">Writing the change. It is listed under Running.</p>
          )}
          {experiment?.status === "awaiting_approval" && (
            <p className="mt-1 text-xs text-muted-foreground">The change is ready under Needs you.</p>
          )}
          {experiment?.status === "failed" && experiment.note && (
            <p className="mt-1 text-xs text-muted-foreground">{experiment.note}</p>
          )}
        </div>
      </button>
      {!(experiment && OPEN_TEST.has(experiment.status)) && (
        <div className="shrink-0 p-3 pl-0">
          <Button size="sm" onClick={onTest} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Designing…" : "Test a fix"}
          </Button>
        </div>
      )}
      </div>
      {open && (
        <>
          <ul className="divide-y divide-border border-t border-border">
            {signal.evidence.map((item) => (
              <EvidenceRow key={item.id} item={item} />
            ))}
          </ul>
          {signal.status !== "experimenting" && (
            <div className="flex justify-end border-t border-border p-2">
              <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Dismiss problem
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EvidenceRow({ item }: { item: Evidence }) {
  const Icon = SOURCE_ICON[item.source];
  return (
    <li className="flex gap-3 px-3 py-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p>&ldquo;{item.title}&rdquo;</p>
        {item.body && item.source !== "slack" && <p className="mt-0.5 text-muted-foreground">{item.body}</p>}
        <p className="mt-0.5 text-muted-foreground">
          {SOURCE_LABEL[item.source]}
          {item.source === "slack" && item.body && ` ${item.body}`} · {item.author} · <RelativeTime date={item.occurredAt} />
          {item.synthetic && (
            <Badge variant="outline" className="ml-2 px-1 py-0 text-[10px]">
              synthetic
            </Badge>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5 underline">
              open <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </p>
      </div>
    </li>
  );
}

const STATUS_TEXT: Record<Experiment["status"], string> = {
  building: "Writing the change",
  awaiting_approval: "Ready to ship",
  queued: "Queued",
  running: "Running",
  awaiting_rollout: "Won — ready to roll out",
  rolled_out: "Rolled out",
  stopped: "Turned off",
  rejected: "Rejected",
  failed: "Failed",
};

function ExperimentCard({
  experiment,
  signal,
  actions,
}: {
  experiment: Experiment;
  signal?: Signal;
  actions?: React.ReactNode;
}) {
  const readout = experiment.readout;
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{experiment.title}</p>
        <Badge variant={experiment.status === "failed" ? "destructive" : "secondary"}>{STATUS_TEXT[experiment.status]}</Badge>
        {experiment.version > 1 && <Badge variant="muted">v{experiment.version}</Badge>}
      </div>
      <p className="text-xs">{experiment.hypothesis}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Why</dt>
        <dd>{signal ? `${signal.title} (${signal.evidence.length} pieces of evidence)` : "—"}</dd>
        <dt className="text-muted-foreground">Change</dt>
        <dd>{experiment.treatment}</dd>
        <dt className="text-muted-foreground">Measures</dt>
        <dd>
          {experiment.metric}
          {experiment.guardrail && <span className="text-muted-foreground"> · guardrail: {experiment.guardrail}</span>}
        </dd>
      </dl>
      {readout && (
        <div className="rounded bg-muted/60 p-2 text-xs">
          {readout.arms.map((arm) => (
            <span key={arm.arm} className="mr-4">
              {arm.arm === "control" ? "Current" : "New"}: {arm.conversions}/{arm.visitors}
              {arm.rate != null && ` (${(arm.rate * 100).toFixed(1)}%)`}
            </span>
          ))}
          {readout.lift != null && (
            <span className="mr-4">
              Lift {readout.lift > 0 ? "+" : ""}
              {(readout.lift * 100).toFixed(1)}%
            </span>
          )}
          {readout.pValue != null && <span className="text-muted-foreground">p = {readout.pValue.toFixed(3)}</span>}
          {readout.syntheticShare > 0 && (
            <span className="ml-2 text-muted-foreground">({Math.round(readout.syntheticShare * 100)}% synthetic traffic)</span>
          )}
        </div>
      )}
      {experiment.note && !experiment.coderSessionId && <p className="text-xs text-muted-foreground">{experiment.note}</p>}
      {experiment.status === "building" && experiment.coderSessionId && <BuildLive experimentId={experiment.id} />}
      {experiment.overlap && !DONE.has(experiment.status) && (
        <p className="rounded bg-muted/60 p-2 text-xs">{experiment.overlap}</p>
      )}
      {experiment.cleanup && experiment.cleanup.status !== "awaiting" && (
        <p className="text-xs text-muted-foreground">
          {experiment.cleanup.status === "merged"
            ? "Code cleaned up: the experiment switch is gone."
            : experiment.cleanup.status === "building"
              ? "Writing the code cleanup."
              : experiment.cleanup.note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {experiment.status === "building" && experiment.buildUrl && (
          <a
            href={experiment.buildUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
          >
            {experiment.builder === "cursor" ? "Watch it in Cursor" : "Watch the run on GitHub"}{" "}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {experiment.draftPath && !experiment.prUrl && (
          <a
            href={`/api/autopilot/experiments/${experiment.id}/draft`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
          >
            View the change <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {experiment.prUrl && (
          <a
            href={experiment.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
          >
            Pull request #{experiment.prNumber} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function CleanupCard({
  experiment,
  busy,
  onApprove,
  onDismiss,
}: {
  experiment: Experiment;
  busy: string | null;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const cleanup = experiment.cleanup!;
  const kept = cleanup.keep === "treatment" ? "the new version" : "the original version";
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Finish: {experiment.title}</p>
        <Badge variant="secondary">Remove experiment code</Badge>
      </div>
      <p className="text-xs">
        Everyone already sees {kept}. This deletes the experiment switch and the other version from the code. It
        doesn&apos;t change what anyone sees.
      </p>
      {cleanup.note && <p className="text-xs text-muted-foreground">{cleanup.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onApprove} disabled={busy !== null}>
          {busy === experiment.id + "approve-cleanup" && <Loader2 className="animate-spin" />}
          Approve cleanup
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy !== null}>
          Keep the switch
        </Button>
        {cleanup.prUrl ? (
          <a
            href={cleanup.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
          >
            Pull request #{cleanup.prNumber} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <a
            href={`/api/autopilot/experiments/${experiment.id}/draft?cleanup=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
          >
            View the change <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
