import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LabExperiment } from "@/lib/lab/advance";
import { approveLaunch, approveShip } from "@/lib/lab/store";
import { LabSection } from "./lab-ui";

export function NeedsYou({ experiments }: { experiments: LabExperiment[] }) {
  if (!experiments.length) return null;
  return (
    <LabSection id="needs" title="Needs you">
      {experiments.map((experiment) => (
        <div key={experiment.id} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
          <div className="min-w-0 flex-1">
            <Link href={`/experiments/${experiment.id}`} className="text-sm font-semibold hover:text-primary">
              {experiment.proposal.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {experiment.stage === "shipping"
                ? experiment.readout?.headline
                : "The design is ready. Review the plan before traffic is exposed."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              experiment.stage === "shipping" ? approveShip(experiment.id) : approveLaunch(experiment.id)
            }
          >
            {experiment.stage === "shipping" ? "Approve & merge" : "Approve launch"}
          </Button>
        </div>
      ))}
    </LabSection>
  );
}
