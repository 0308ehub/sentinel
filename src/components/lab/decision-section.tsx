"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LabExperiment } from "@/lib/lab/advance";
import { designProposal } from "@/lib/lab/store";
import { DetailSection } from "./lab-ui";
import { pct, recommendationLabel, recommendationTone, STOP_LABELS } from "./labels";
import { ShipReview } from "./ship-review";

export function DecisionSection({ experiment }: { experiment: LabExperiment }) {
  const readout = experiment.readout!;
  const router = useRouter();
  const [story, setStory] = useState({ headline: readout.headline, paragraphs: readout.summary, by: "rules" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lab/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readout, design: experiment.design }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((value: { headline?: string; paragraphs?: string[]; by?: string }) => {
        if (value.headline && value.paragraphs)
          setStory({ headline: value.headline, paragraphs: value.paragraphs, by: value.by ?? "rules" });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [experiment.design, readout]);
  const ranDays = experiment.run?.stopDay ?? experiment.design?.durationDays ?? 0;
  const plannedDays = experiment.design?.durationDays ?? ranDays;
  const progress = plannedDays ? (ranDays / plannedDays) * 100 : 0;
  function designFollowUp() {
    const id = `${experiment.id}-next`;
    designProposal(id);
    router.push(`/experiments/${id}`);
  }
  return (
    <DetailSection title="Decision">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${recommendationTone(readout.recommendation)}`}
          >
            {recommendationLabel(readout)}
          </span>
          <h3 className="mt-3 text-lg font-semibold">{readout.headline}</h3>
          {experiment.stopReason && (
            <p className="mt-1 text-xs text-muted-foreground">{STOP_LABELS[experiment.stopReason]}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{readout.daysSaved} days saved</span>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>
            Ran {ranDays} of {plannedDays} planned days
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-5 rounded-md bg-muted/50 p-4">
        <b className="text-xs">Kismet&apos;s read</b>
        <span className="ml-2 text-[11px] text-muted-foreground">
          {story.by === "model" ? "Written by the model" : "Written by Kismet’s rules"}
        </span>
        <h4 className="mt-2 text-sm font-semibold">{story.headline}</h4>
        {story.paragraphs.map((paragraph, index) => (
          <p key={index} className="mt-2 text-xs leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
      <p className="mt-4 text-sm">
        <b>Primary result:</b> {pct(readout.primary.lift)} (95% CI {pct(readout.primary.ciLow)} to{" "}
        {pct(readout.primary.ciHigh)}).
      </p>
      <div className="mt-4 rounded-md border p-3">
        <b className="text-xs">Next idea</b>
        <p className="mt-1 text-xs">{readout.nextIdea}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={designFollowUp}>
          Design the follow-up
        </Button>
      </div>
      <ShipReview experiment={experiment} />
    </DetailSection>
  );
}
