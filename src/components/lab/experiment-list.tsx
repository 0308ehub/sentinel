"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { resetDemo, runDiscovery, setAutonomy, useLabStore } from "@/lib/lab/store";
import { ClockControl, LabClock } from "./lab-clock";
import { DecidedList } from "./decided-list";
import { LoopStrip } from "./loop-strip";
import { NeedsYou } from "./needs-you";
import { ProposalList } from "./proposal-list";
import { RunningList } from "./running-list";
import { UpdateFeed } from "./update-feed";

export function ExperimentList() {
  const state = useLabStore();
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("demo") !== "1") return;
    resetDemo();
    runDiscovery();
    window.history.replaceState(null, "", "/experiments");
  }, [params]);
  const active = state.experiments.filter((experiment) => ["running", "queued"].includes(experiment.stage));
  const needs = state.experiments.filter(
    (experiment) =>
      (experiment.stage === "designed" && experiment.design) ||
      (experiment.stage === "shipping" && experiment.ship?.status === "awaiting"),
  );
  const proposals = state.experiments.filter((experiment) =>
    ["proposed", "designed", "rejected"].includes(experiment.stage),
  );
  const decided = state.experiments.filter((experiment) =>
    ["decided", "shipping", "shipped"].includes(experiment.stage),
  );
  return (
    <LabClock>
      <div className="h-full overflow-y-auto bg-background">
        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-lg font-semibold">Experiments</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Kismet reads Pantry&apos;s goals, users, and code, decides what to test, runs it, and asks you before
                anything ships.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ClockControl />
              <label className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs">
                <span>Launch: {state.autonomy === "ask" ? "Ask me" : "Within guardrails"}</span>
                <Switch
                  checked={state.autonomy === "auto"}
                  onCheckedChange={(on) => setAutonomy(on ? "auto" : "ask")}
                />
              </label>
              <Button variant="ghost" size="sm" onClick={resetDemo}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reset demo
              </Button>
            </div>
          </header>
          <LoopStrip experiments={state.experiments} latest={state.feed[0]} />
          <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-9">
              <NeedsYou experiments={needs} />
              <RunningList
                experiments={active}
                all={state.experiments}
                day={state.clock.day}
                hasFinished={decided.length > 0}
              />
              <ProposalList experiments={proposals} discovery={state.discovery} customError={state.customError} />
              <DecidedList experiments={decided} />
            </div>
            <UpdateFeed feed={state.feed} />
          </div>
        </main>
      </div>
    </LabClock>
  );
}
