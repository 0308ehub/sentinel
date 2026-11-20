"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ExperimentBoard } from "@/components/autopilot/experiment-board";
import { useAutopilot } from "@/components/autopilot/use-autopilot";
import type { Builder } from "@/lib/autopilot/builders";
import type { Experiment, Signal } from "@/lib/autopilot/types";
import { MoveInCard } from "@/components/workspace/move-in-card";
import type { RunReport } from "@/lib/autopilot/run-report-core";

export function AutopilotView() {
  const query = useAutopilot();
  const state = query.data ?? null;
  const load = query.refetch;
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);

  async function runNow() {
    setRunning(true);
    setMessage(null);
    setReport(null);
    try {
      const res = await fetch("/api/autopilot/tick", { method: "POST" });
      const result = (await res.json()) as { steps?: string[]; errors?: string[]; report?: RunReport };
      const parts = [...(result.steps ?? []), ...(result.errors ?? [])];
      if (result.report) setReport(result.report);
      else setMessage(parts.length ? parts.join(" ") : "Nothing new to do.");
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
          : body.error ?? "Could not remove the sample data.",
      );
      await load();
    } catch {
      setMessage("Could not remove the sample data. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function createExperiment(input: { title: string; change: string; page: string; builder: Builder }) {
    setBusy("create");
    setMessage("Writing the experiment. This usually takes under a minute.");
    try {
      const response = await fetch("/api/autopilot/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not create the experiment.");
      setMessage(body.message ?? "Created.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function testSignal(signal: Signal, builder: Builder) {
    if (state?.experiments.some((experiment) => experiment.status === "building")) {
      setMessage("Kismet is already writing a change. It is listed in Sessions.");
      return;
    }
    setBusy(signal.id);
    setMessage("Designing the test. This usually takes under a minute.");
    try {
      const res = await fetch(`/api/autopilot/signals/${signal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", builder }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      setMessage(body.message ?? body.error ?? "The test did not start.");
      await load();
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

  async function saveAdjustments(target: Signal | Experiment, adjustments: string) {
    const kind = "version" in target ? "experiments" : "signals";
    const response = await fetch(`/api/autopilot/${kind}/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustments }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(body.error || "Could not save your notes.");
    await load();
  }

  async function scheduleRollout(experiment: Experiment, phases: { at: string; pass: number }[]) {
    setBusy(experiment.id + "schedule");
    setMessage(null);
    try {
      const res = await fetch(`/api/autopilot/experiments/${experiment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", phases }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Could not schedule the rollout.");
      setMessage(body.message ?? "Scheduled.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function act(
    experiment: Experiment,
    action: "approve" | "reject" | "cancel" | "rollout" | "stop" | "approve-cleanup" | "dismiss-cleanup",
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
      <div className="grid h-full place-items-center" role="status" aria-label="Loading">
        <Loader2 className="h-5 w-5 animate-spin text-[#9aa0a8]" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && <MoveInCard />}
      <div className="min-h-0 flex-1"><ExperimentBoard
      state={state}
      running={running}
      busy={busy}
      message={message}
      report={report}
      onDismissReport={() => setReport(null)}
      onRun={() => void runNow()}
      onRemoveSample={() => void removeSample()}
      onTest={(signal, builder) => void testSignal(signal, builder)}
      onDismiss={(signal) => void dismissSignal(signal)}
      onAct={(experiment, action) => void act(experiment, action)}
      onRated={() => void load()}
      onSchedule={scheduleRollout}
      onCreate={createExperiment}
      onSaveAdjustments={saveAdjustments}
      /></div>
    </div>
  );
}
