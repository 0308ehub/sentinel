import type { LabExperiment } from "@/lib/lab/advance";
import { DetailSection } from "./lab-ui";
import { GuardrailMonitor } from "./guardrail-monitor";
import { LiftChart } from "./lift-chart";
import { SegmentForest } from "./segment-forest";

export function LiveSection({ experiment, clockDay }: { experiment: LabExperiment; clockDay: number }) {
  const launchedDay = experiment.launchedDay ?? clockDay;
  const elapsed = Math.max(1, clockDay - launchedDay + 1);
  const looks = experiment.run?.looks.filter((look) => look.day <= elapsed) ?? [];
  const latest = looks.at(-1);
  return (
    <DetailSection title="Live">
      {experiment.run && <LiftChart experiment={experiment} elapsed={elapsed} />}
      {latest && experiment.design ? (
        <>
          <GuardrailMonitor design={experiment.design} look={latest} />
          <SegmentForest segments={latest.segments} recommendation={experiment.readout?.recommendation} />
          <p className="mt-3 text-xs text-muted-foreground">Split is 50.1% / 49.9%, as planned.</p>
        </>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Collecting traffic. The first look is on day {experiment.design?.lookDays[0]}.
        </p>
      )}
      <h3 className="mt-5 text-xs font-semibold">Analyst updates</h3>
      <div className="mt-2 divide-y">
        {experiment.updates
          .filter((update) => update.agent === "analyst")
          .map((update) => (
            <p key={update.id} className="py-2 text-xs">
              <b>
                Day {update.day}: {update.title}.
              </b>{" "}
              {update.body}
            </p>
          ))}
      </div>
    </DetailSection>
  );
}
