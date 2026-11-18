"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ExperimentBoard } from "@/components/autopilot/experiment-board";
import type { AutopilotState, Experiment, Signal } from "@/lib/autopilot/types";

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
          : body.error ?? "Could not remove the sample data.",
      );
      await load();
    } catch {
      setMessage("Could not remove the sample data. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function createExperiment(input: { title: string; change: string; page: string }) {
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

  async function testSignal(signal: Signal) {
    if (state?.experiments.some((experiment) => experiment.status === "building")) {
      setMessage("Kismet is already writing a change. It is listed in the table.");
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
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  return (
    <ExperimentBoard
      state={state}
      running={running}
      busy={busy}
      message={message}
      onRun={() => void runNow()}
      onRemoveSample={() => void removeSample()}
      onTest={(signal) => void testSignal(signal)}
      onDismiss={(signal) => void dismissSignal(signal)}
      onAct={(experiment, action) => void act(experiment, action)}
      onRated={() => void load()}
      onSchedule={scheduleRollout}
      onCreate={createExperiment}
    />
  );
}
