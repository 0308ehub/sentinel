"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PANTRY } from "@/lib/lab/company";
import type { LabExperiment } from "@/lib/lab/advance";
import { approveLaunch, approveShip, designProposal, useLabStore } from "@/lib/lab/store";
import { ClockControl, LabClock } from "./lab-clock";
import { DecisionSection } from "./decision-section";
import { DetailSection } from "./lab-ui";
import { LiveSection } from "./live-section";
import { PlanSection } from "./plan-section";
import { STAGE_LABELS } from "./labels";

const stepRank: Record<LabExperiment["stage"], number> = {
  proposed: 0,
  designed: 1,
  queued: 2,
  running: 3,
  stopped: 4,
  decided: 4,
  shipping: 5,
  shipped: 6,
  rejected: 0,
};

function StageStepper({ stage }: { stage: LabExperiment["stage"] }) {
  const steps = ["Proposed", "Designed", "Queued", "Running", "Decided", "Awaiting review", "Shipped"];
  return (
    <ol className="mt-1 flex max-w-full items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, index) => (
        <li
          key={step}
          className={`flex shrink-0 items-center gap-1 text-[10px] ${index === stepRank[stage] ? "font-semibold text-primary" : index < stepRank[stage] ? "text-foreground" : "text-muted-foreground/55"}`}
        >
          {index > 0 && <span aria-hidden>›</span>}
          {step}
        </li>
      ))}
    </ol>
  );
}

function PrimaryAction({ experiment }: { experiment: LabExperiment }) {
  if (experiment.stage === "proposed")
    return (
      <Button size="sm" onClick={() => designProposal(experiment.id)}>
        Design it
      </Button>
    );
  if (experiment.stage === "designed" && experiment.design)
    return (
      <Button size="sm" onClick={() => approveLaunch(experiment.id)}>
        Approve launch
      </Button>
    );
  if (experiment.stage === "shipping" && experiment.ship?.status === "awaiting")
    return (
      <Button size="sm" onClick={() => approveShip(experiment.id)}>
        Approve & merge
      </Button>
    );
  return (
    <span className="rounded-md border bg-muted px-2 py-1 text-[11px] font-medium">
      {STAGE_LABELS[experiment.stage]}
    </span>
  );
}

function WhySection({ experiment }: { experiment: LabExperiment }) {
  return (
    <DetailSection title="Why Kismet picked this">
      <p className="text-sm leading-relaxed">{experiment.proposal.hypothesis}</p>
      <div className="mt-4 divide-y">
        {experiment.proposal.evidenceIds.map((id) => {
          const evidence = PANTRY.evidence.find((item) => item.id === id);
          return evidence ? (
            <div key={id} className="py-2">
              <span className="text-[11px] uppercase text-muted-foreground">{evidence.source.replace("_", " ")}</span>
              <p className="text-xs">
                <b>{evidence.title}.</b> {evidence.detail}
              </p>
            </div>
          ) : null;
        })}
      </div>
      <div className="mt-4 rounded-md bg-muted p-3">
        <b className="text-xs">What it will not do</b>
        <p className="mt-1 text-xs text-muted-foreground">
          It will not repeat a known loss or run beside a test that changes the same file. {experiment.proposal.risk}
        </p>
      </div>
    </DetailSection>
  );
}

export function LabExperimentView({ id }: { id: string }) {
  const { experiments, clock } = useLabStore();
  const experiment = experiments.find((item) => item.id === id);
  if (!experiment) return null;
  return (
    <LabClock>
      <div className="h-full overflow-y-auto bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <Link
              href="/experiments"
              className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Experiments
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold">{experiment.proposal.title}</h1>
              <StageStepper stage={experiment.stage} />
            </div>
            <div className="hidden md:block">
              <ClockControl />
            </div>
            <PrimaryAction experiment={experiment} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-8 overflow-hidden px-4 py-6">
          <WhySection experiment={experiment} />
          {experiment.design && <PlanSection experiment={experiment} />}
          {experiment.launchedDay !== null && <LiveSection experiment={experiment} clockDay={clock.day} />}
          {experiment.readout && <DecisionSection experiment={experiment} />}
        </main>
      </div>
    </LabClock>
  );
}
