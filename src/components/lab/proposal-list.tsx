"use client";

import { FormEvent, useState } from "react";
import { Check, ChevronDown, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PANTRY } from "@/lib/lab/company";
import type { LabExperiment } from "@/lib/lab/advance";
import { addCustomIdea, designProposal, rejectProposal, runDiscovery } from "@/lib/lab/store";
import { LabSection } from "./lab-ui";
import { objectiveLabel, pct } from "./labels";

const sources = [
  "Read 3 company goals",
  "Checked 4 analytics funnels",
  "Read 1,240 support tickets",
  "Watched 86 session replays",
  "Scanned 9 files in Pantry’s codebase",
  "Checked 3 past experiments, skipped 2 ideas that already lost",
];

function ProposalRow({ experiment }: { experiment: LabExperiment }) {
  const [open, setOpen] = useState(false);
  const proposal = experiment.proposal;
  const designing = experiment.stage === "designed" && !experiment.design;
  const inactive = Boolean(proposal.skippedReason) || experiment.stage === "rejected";
  return (
    <article className={`rounded-md border p-3 ${inactive ? "bg-muted/40 text-muted-foreground" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border bg-muted px-2 py-0.5 text-[11px]">
              {objectiveLabel(proposal.objective)}
            </span>
            <b className="text-sm">{proposal.title}</b>
          </div>
          <p className="mt-2 text-xs leading-relaxed">{proposal.skippedReason ?? proposal.hypothesis}</p>
          <button
            type="button"
            className="mt-2 flex items-center gap-1 text-[11px] text-primary"
            onClick={() => setOpen(!open)}
          >
            {proposal.evidenceIds.length} evidence {proposal.evidenceIds.length === 1 ? "item" : "items"}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="mt-2 space-y-1 rounded-md bg-muted p-2 text-xs">
              {proposal.evidenceIds.map((id) => {
                const evidence = PANTRY.evidence.find((item) => item.id === id);
                return evidence ? (
                  <p key={id}>
                    <b>{evidence.title}:</b> {evidence.detail}
                  </p>
                ) : null;
              })}
            </div>
          )}
          <p className="mt-2 break-words text-[11px] text-muted-foreground">
            {proposal.page} · {proposal.files.join(", ")}
          </p>
        </div>
        {!inactive && (
          <div className="flex items-end justify-between gap-3 text-left sm:block sm:text-right">
            <div>
              <p className="text-xs font-semibold">{pct(proposal.expectedLift)} expected</p>
              <p className="text-[11px] capitalize text-muted-foreground">{proposal.confidence} confidence</p>
            </div>
            <div className="flex gap-1 sm:mt-3">
              <Button
                size="sm"
                onClick={() => designProposal(experiment.id)}
                disabled={experiment.stage === "designed"}
              >
                {designing ? "Designing…" : experiment.design ? "Designed" : "Design it"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => rejectProposal(experiment.id)}>
                Skip
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function ProposalList({
  experiments,
  discovery,
  customError,
}: {
  experiments: LabExperiment[];
  discovery: { status: "idle" | "reading" | "done"; step: number };
  customError: string | null;
}) {
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const id = await addCustomIdea(idea);
    setSubmitting(false);
    if (id) setIdea("");
  }
  return (
    <LabSection id="proposals" title="Proposals">
      {discovery.status === "idle" ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <FlaskConical className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Start with the evidence</p>
          <p className="mt-1 text-xs text-muted-foreground">Kismet reads Pantry before it proposes a change.</p>
          <Button className="mt-4" size="sm" onClick={runDiscovery}>
            Run discovery
          </Button>
        </div>
      ) : discovery.status === "reading" ? (
        <div className="divide-y rounded-md border">
          {sources.map((source, index) => (
            <div
              key={source}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm ${index > discovery.step ? "text-muted-foreground/50" : ""}`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] ${index < discovery.step ? "border-primary bg-primary text-primary-foreground" : ""}`}
              >
                {index < discovery.step ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {source}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {experiments
            .sort((a, b) => b.proposal.impactScore - a.proposal.impactScore)
            .map((experiment) => (
              <ProposalRow key={experiment.id} experiment={experiment} />
            ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder="Have an idea? Kismet will check it against the evidence"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <Button
          size="sm"
          disabled={!idea.trim() || submitting}
          className="disabled:bg-primary/45 disabled:text-primary-foreground/90"
        >
          {submitting ? "Checking…" : "Check idea"}
        </Button>
      </form>
      {customError && <p className="mt-2 text-xs text-muted-foreground">{customError}</p>}
    </LabSection>
  );
}
