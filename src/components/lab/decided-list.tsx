import Link from "next/link";
import type { LabExperiment } from "@/lib/lab/advance";
import { EmptyState, LabSection } from "./lab-ui";
import { pct, recommendationLabel, recommendationTone } from "./labels";

function shippingStatus(experiment: LabExperiment) {
  if (experiment.stage === "shipped") return `Shipped day ${experiment.stopDay}`;
  if (experiment.stage === "shipping") return "Awaiting review";
  return "Not shipped";
}

export function DecidedList({ experiments }: { experiments: LabExperiment[] }) {
  return (
    <LabSection id="decided" title="Decided">
      {experiments.length ? (
        experiments.map((experiment) => {
          const readout = experiment.readout;
          if (!readout) return null;
          return (
            <Link
              key={experiment.id}
              href={`/experiments/${experiment.id}`}
              className="grid gap-3 border-b py-3 last:border-0 hover:text-primary sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                <b className="text-sm">{experiment.proposal.title}</b>
                <div className="mt-1">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${recommendationTone(readout.recommendation)}`}
                  >
                    {recommendationLabel(readout)}
                  </span>
                </div>
              </div>
              <p className="text-xs tabular-nums">
                <b>{pct(readout.primary.lift)}</b>{" "}
                <span className="text-muted-foreground">
                  ({pct(readout.primary.ciLow)} to {pct(readout.primary.ciHigh)})
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{readout.daysSaved} days saved</span>
              </p>
              <span className="text-xs font-medium text-muted-foreground">{shippingStatus(experiment)}</span>
            </Link>
          );
        })
      ) : (
        <EmptyState>Decisions appear here after a test stops.</EmptyState>
      )}
    </LabSection>
  );
}
