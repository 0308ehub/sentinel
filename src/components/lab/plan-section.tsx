import { OBJECTIVES } from "@/lib/lab/design";
import { PANTRY } from "@/lib/lab/company";
import type { LabExperiment } from "@/lib/lab/advance";
import { CodeDiff } from "./code-diff";
import { DetailSection } from "./lab-ui";
import { SEGMENT_LABELS, pct } from "./labels";

export function PlanSection({ experiment }: { experiment: LabExperiment }) {
  const design = experiment.design!;
  const objective = OBJECTIVES[design.objective];
  const metric = PANTRY.metrics[design.primaryMetric];
  return (
    <DetailSection title="The plan">
      <div className="rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">
        <b>{objective.label}</b>
        <p className="mt-1">
          <b>Optimizing for:</b> {objective.optimizingFor}.
        </p>
        <p className="mt-1 text-muted-foreground">
          <b className="text-foreground">Not optimizing for:</b> {objective.notOptimizingFor}
        </p>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold">Primary result</h3>
          <p className="mt-1 text-sm">
            {metric.label} · MDE {pct(design.mde)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{design.significanceRule}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-1">Look</th>
                  <th>Day</th>
                  <th>z needed</th>
                </tr>
              </thead>
              <tbody>
                {design.boundaries.map((boundary, index) => (
                  <tr key={boundary.look} className="border-t">
                    <td className="py-1.5">{boundary.look}</td>
                    <td>{design.lookDays[index]}</td>
                    <td>{boundary.efficacyZ.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold">The numbers</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Sample per arm</dt>
            <dd>
              {design.perArm.toLocaleString()} ({design.maxPerArm.toLocaleString()} max)
            </dd>
            <dt className="text-muted-foreground">Traffic</dt>
            <dd>{(design.allocation * 100).toFixed(0)}%</dd>
            <dt className="text-muted-foreground">Duration</dt>
            <dd>{design.durationDays} days</dd>
            <dt className="text-muted-foreground">Planned looks</dt>
            <dd>{design.looks}</dd>
          </dl>
          <p className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">{design.trafficNote}</p>
        </div>
      </div>
      <h3 className="mt-6 text-xs font-semibold">Guardrails</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2">Metric</th>
              <th>Allowed change</th>
              <th>Action</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {design.guardrails.map((guardrail) => (
              <tr key={guardrail.metric} className="border-t">
                <td className="py-2">{PANTRY.metrics[guardrail.metric].label}</td>
                <td>{pct(-guardrail.margin)}</td>
                <td>{guardrail.action === "stop" ? "Stop now" : "Block ship"}</td>
                <td>{guardrail.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-6 text-xs font-semibold">Segments</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2">Segment</th>
              <th>In test</th>
              <th>Success measured by</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {design.segments.map((segment) => (
              <tr key={segment.segment} className="border-t">
                <td className="py-2 font-medium">{SEGMENT_LABELS[segment.segment]}</td>
                <td>{segment.included ? "Yes" : "No"}</td>
                <td>{PANTRY.metrics[segment.successMetric].label}</td>
                <td>{segment.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-6 text-xs font-semibold">Variants</h3>
      <div className="mt-2 grid min-w-0 gap-3 lg:grid-cols-2">
        {design.variants.map((variant) => (
          <div key={variant.id} className="min-w-0 rounded-md border p-3">
            <b className="text-xs">{variant.name}</b>
            <p className="mt-1 text-xs text-muted-foreground">{variant.description}</p>
            {variant.diff && <CodeDiff before={variant.diff.before} after={variant.diff.after} />}
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
