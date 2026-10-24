"use client";

import { useEffect, useState } from "react";
import { Loader2, Pin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExploreFunnelStep, ExploreOptions, ExploreResult, ExploreSpec, FunnelStepInput, SegmentFilter } from "@/lib/analytics/explore-types";
import { blankFilter, filterLabel, type Audience, type SavedSegment } from "@/lib/analytics/library";
import { formatCount, formatDuration } from "@/lib/analytics/present";
import { useAnalyticsLibrary } from "@/stores/analytics-store";

const PRIMARY = "#0571d3";
const COMPARE = "#16803c";

export function FunnelsView() {
  const segments = useAnalyticsLibrary((state) => state.segments);
  const ensureDashboard = useAnalyticsLibrary((state) => state.ensureDashboard);
  const addCard = useAnalyticsLibrary((state) => state.addCard);
  const [options, setOptions] = useState<ExploreOptions | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [steps, setSteps] = useState<FunnelStepInput[]>([{ kind: "any" }, { kind: "any" }]);
  const [withinDays, setWithinDays] = useState<number | null>(null);
  const [lastDays, setLastDays] = useState<number | null>(null);
  const [segment, setSegment] = useState<SegmentFilter | null>(null);
  const [compare, setCompare] = useState<SegmentFilter | null | false>(false);
  const [primary, setPrimary] = useState<ExploreResult | null>(null);
  const [secondary, setSecondary] = useState<ExploreResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/analytics/explore", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/analytics/audience", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([events, people]: [ExploreOptions & { hint?: string; error?: string }, Audience]) => {
        if (cancelled) return;
        if (!events.products) throw new Error(events.hint || events.error || "Could not load events.");
        setOptions(events);
        if (Array.isArray(people.customers)) setAudience(people);
        setSteps((current) => (current.some((step) => step.kind === "product") ? current : defaultSteps(events.products)));
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queryKey = JSON.stringify({ steps, withinDays, lastDays, segment, compare });

  useEffect(() => {
    if (!options) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const base = specFor(steps, withinDays, lastDays, segment);
    const other = compare === false ? null : specFor(steps, withinDays, lastDays, compare);
    Promise.all([run(base), other ? run(other) : Promise.resolve(null)])
      .then(([left, right]) => {
        if (cancelled) return;
        setPrimary(left);
        setSecondary(right);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [options, queryKey, steps, withinDays, lastDays, segment, compare]);

  if (!options) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {error || "Loading events…"}
      </div>
    );
  }

  const title = steps.map((step) => (step.kind === "any" ? "Any order" : step.product)).join(" → ");

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-border p-3">
        <p className="text-xs text-muted-foreground">Steps, in order</p>
        <div className="mt-2 space-y-1">
          {steps.map((step, index) => (
            <div key={`${index}-${step.kind}-${step.product ?? "any"}`} className="flex items-center gap-2">
              <span className="w-4 text-xs text-muted-foreground">{index + 1}</span>
              <select
                aria-label={`Step ${index + 1}`}
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                value={step.kind === "any" ? "*" : step.product}
                onChange={(event) => setSteps(replaceStep(steps, index, event.target.value))}
              >
                <option value="*">Any order</option>
                {options.products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
              {steps.length > 2 && (
                <button type="button" aria-label={`Remove step ${index + 1}`} className="text-muted-foreground hover:text-foreground" onClick={() => setSteps(steps.filter((_, item) => item !== index))}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {steps.length < 6 && (
          <Button type="button" variant="outline" size="sm" className="mt-2 w-full text-xs" onClick={() => setSteps([...steps, nextStep(steps, options.products)])}>
            <Plus className="h-3 w-3" />
            Add step
          </Button>
        )}

        <p className="mt-5 text-xs text-muted-foreground">Completed within</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Choice active={withinDays === 1} onClick={() => setWithinDays(1)} label="1 day" />
          <Choice active={withinDays === 7} onClick={() => setWithinDays(7)} label="7 days" />
          <Choice active={withinDays == null} onClick={() => setWithinDays(null)} label="Any time" />
        </div>

        <p className="mt-5 text-xs text-muted-foreground">Date range</p>
        <div className="mt-2 flex gap-1">
          <Choice active={lastDays == null} onClick={() => setLastDays(null)} label="All" />
          <Choice active={lastDays === 7} onClick={() => setLastDays(7)} label="7d" />
          <Choice active={lastDays === 3} onClick={() => setLastDays(3)} label="3d" />
        </div>

        <SegmentPicker
          label="Segment"
          options={options}
          audience={audience}
          segments={segments}
          value={segment}
          onChange={(filter) => setSegment(filter === false ? null : filter)}
        />
        <SegmentPicker
          label="Compare"
          options={options}
          audience={audience}
          segments={segments}
          value={compare}
          allowOff
          onChange={setCompare}
        />
        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Each step is a purchase in samples.bakehouse, {options.startDay} to {options.endDay}. A customer counts only if the later step happens after the earlier one.
        </p>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-[11px] text-muted-foreground">
              {filterLabel(segment)}
              {compare !== false ? ` compared with ${filterLabel(compare)}` : ""}
              {loading ? " · Running on Databricks…" : ""}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const id = ensureDashboard();
              addCard(id, { title, spec: specFor(steps, withinDays, lastDays, segment) });
              setNotice("Pinned to the board.");
            }}
          >
            <Pin className="h-3 w-3" />
            Pin
          </Button>
        </div>
        {notice && <p className="mt-3 text-xs text-muted-foreground">{notice}</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {primary && (
          <FunnelReport
            primary={primary}
            secondary={secondary}
            primaryLabel={filterLabel(segment)}
            compareLabel={compare === false ? "" : filterLabel(compare)}
          />
        )}
      </div>
    </div>
  );
}

function FunnelReport({
  primary,
  secondary,
  primaryLabel,
  compareLabel,
}: {
  primary: ExploreResult;
  secondary: ExploreResult | null;
  primaryLabel: string;
  compareLabel: string;
}) {
  const first = primary.steps[0]?.users ?? 0;
  const last = primary.steps[primary.steps.length - 1];
  return (
    <>
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-xs text-muted-foreground">Conversion through the last step</p>
          <p className="font-mono text-2xl tabular-nums">{last && first > 0 ? `${((last.users / first) * 100).toFixed(1)}%` : "—"}</p>
        </div>
        <div className="mt-4 flex h-56 items-end gap-4">
          {primary.steps.map((step, index) => {
            const other = secondary?.steps[index];
            const left = first > 0 ? step.users / first : 0;
            const rightBase = secondary?.steps[0]?.users ?? 0;
            const right = other && rightBase > 0 ? other.users / rightBase : 0;
            return (
              <div key={`${step.name}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-1">
                  <Bar height={left} color={PRIMARY} label={formatCount(step.users)} />
                  {secondary && <Bar height={right} color={COMPARE} label={formatCount(other?.users ?? 0)} />}
                </div>
                <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">
                  {index + 1}. {step.name}
                </p>
              </div>
            );
          })}
        </div>
        {secondary && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            <span className="mr-3 inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: PRIMARY }} /> {primaryLabel}</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: COMPARE }} /> {compareLabel}</span>
          </p>
        )}
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2 font-normal">Step</th>
              {secondary && <th className="px-3 py-2 font-normal">Segment</th>}
              <th className="px-3 py-2 text-right font-normal">Users</th>
              <th className="px-3 py-2 text-right font-normal">Conversion</th>
              <th className="px-3 py-2 text-right font-normal">From prior</th>
              <th className="px-3 py-2 text-right font-normal">Median time</th>
            </tr>
          </thead>
          <tbody>
            {primary.steps.map((step, index) => {
              const other = secondary?.steps[index];
              return (
                <StepRows
                  key={`${step.name}-${index}`}
                  index={index}
                  step={step}
                  other={other}
                  primaryLabel={primaryLabel}
                  compareLabel={compareLabel}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StepRows({
  index,
  step,
  other,
  primaryLabel,
  compareLabel,
}: {
  index: number;
  step: ExploreFunnelStep;
  other?: ExploreFunnelStep;
  primaryLabel: string;
  compareLabel: string;
}) {
  return (
    <>
      <tr className="border-b border-border">
        <td className="px-3 py-2">{index + 1}. {step.name}</td>
        {other && <td className="px-3 py-2 text-muted-foreground">{primaryLabel}</td>}
        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCount(step.users)}</td>
        <td className="px-3 py-2 text-right font-mono tabular-nums">{percent(step.conversion)}</td>
        <td className="px-3 py-2 text-right font-mono tabular-nums">{index === 0 ? "—" : percent(step.fromPrior)}</td>
        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatDuration(step.medianSeconds)}</td>
      </tr>
      {other && (
        <tr className="border-b border-border">
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-muted-foreground">{compareLabel}</td>
          <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCount(other.users)}</td>
          <td className="px-3 py-2 text-right font-mono tabular-nums">{percent(other.conversion)}</td>
          <td className="px-3 py-2 text-right font-mono tabular-nums">{index === 0 ? "—" : percent(other.fromPrior)}</td>
          <td className="px-3 py-2 text-right font-mono tabular-nums">{formatDuration(other.medianSeconds)}</td>
        </tr>
      )}
    </>
  );
}

function Bar({ height, color, label }: { height: number; color: string; label: string }) {
  return (
    <div className="flex h-full w-8 flex-col justify-end">
      <p className="mb-1 text-center text-[11px] font-mono tabular-nums">{label}</p>
      <div className="rounded-sm" style={{ height: `${Math.max(height * 100, height > 0 ? 8 : 0)}%`, background: color }} />
    </div>
  );
}

function SegmentPicker({
  label,
  options,
  audience,
  segments,
  value,
  allowOff,
  onChange,
}: {
  label: string;
  options: ExploreOptions;
  audience: Audience | null;
  segments: SavedSegment[];
  value: SegmentFilter | null | false;
  allowOff?: boolean;
  onChange: (filter: SegmentFilter | null | false) => void;
}) {
  const active = value ? value : null;
  const current = active ?? blankFilter();
  const matched = active ? segments.find((segment) => JSON.stringify(segment.filter) === JSON.stringify(current))?.id ?? "" : "";
  const filterText = filterLabel(active);
  const custom = Boolean(active) && !matched && filterText !== "Everyone";
  const setFilter = (patch: Partial<SegmentFilter>) => onChange({ ...blankFilter(), ...(value ? value : {}), ...patch });
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{value === false ? "Off" : filterText}</p>
      <select
        aria-label={label}
        className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
        value={value === false ? "off" : matched || (custom ? "custom" : "")}
        onChange={(event) => {
          if (event.target.value === "off") {
            onChange(false);
            return;
          }
          const saved = segments.find((item) => item.id === event.target.value);
          onChange(saved ? saved.filter : null);
        }}
      >
        {allowOff && <option value="off">No comparison</option>}
        <option value="">Everyone</option>
        {custom && <option value="custom">{filterText}</option>}
        {segments.map((segment) => (
          <option key={segment.id} value={segment.id}>
            {segment.name}
          </option>
        ))}
      </select>
      <label className="mt-3 block text-[11px] text-muted-foreground">
        Bought
        <select className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" value={current.product ?? ""} onChange={(event) => setFilter({ product: event.target.value || null })}>
          <option value="">Any product</option>
          {options.products.map((product) => (
            <option key={product} value={product}>{product}</option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-[11px] text-muted-foreground">
        Paid with
        <select className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" value={current.payment ?? ""} onChange={(event) => setFilter({ payment: event.target.value || null })}>
          <option value="">Any method</option>
          {options.payments.map((payment) => (
            <option key={payment} value={payment}>{payment}</option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-[11px] text-muted-foreground">
        At least this many orders
        <input type="number" min={1} max={30} value={current.minOrders} onChange={(event) => setFilter({ minOrders: Number(event.target.value) || 1 })} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" />
      </label>
      {audience && audience.customers.length > 0 && (
        <label className="mt-2 block text-[11px] text-muted-foreground">
          Specific customer
          <select className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" value={current.customerId ?? ""} onChange={(event) => setFilter({ customerId: event.target.value || null })}>
            <option value="">Anyone</option>
            {audience.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.label}</option>
            ))}
          </select>
        </label>
      )}
      {audience && audience.cities.length > 0 && (
        <label className="mt-2 block text-[11px] text-muted-foreground">
          City
          <select className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" value={current.city ?? ""} onChange={(event) => setFilter({ city: event.target.value || null })}>
            <option value="">Any city</option>
            {audience.cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>
      )}
      {audience && audience.states.length > 0 && (
        <label className="mt-2 block text-[11px] text-muted-foreground">
          State
          <select className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" value={current.state ?? ""} onChange={(event) => setFilter({ state: event.target.value || null })}>
            <option value="">Any state</option>
            {audience.states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-md border px-2.5 py-1 text-xs", active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
      {label}
    </button>
  );
}

function specFor(steps: FunnelStepInput[], withinDays: number | null, lastDays: number | null, segment: SegmentFilter | null): ExploreSpec {
  return {
    kind: "funnel",
    measure: "uniques",
    events: [],
    lastDays: lastDays === 3 || lastDays === 7 ? lastDays : null,
    breakdown: "product",
    steps,
    withinDays: withinDays === 1 || withinDays === 7 ? withinDays : null,
    segment,
  };
}

async function run(spec: ExploreSpec): Promise<ExploreResult> {
  const res = await fetch("/api/analytics/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  const body = (await res.json()) as ExploreResult & { hint?: string; error?: string };
  if (!res.ok) throw new Error(body.hint || body.error || "The funnel query failed.");
  return body;
}

function defaultSteps(products: string[]): FunnelStepInput[] {
  const steps: FunnelStepInput[] = [{ kind: "any" }];
  if (products[0]) steps.push({ kind: "product", product: products[0] });
  else steps.push({ kind: "any" });
  return steps;
}

function replaceStep(steps: FunnelStepInput[], index: number, value: string): FunnelStepInput[] {
  return steps.map((step, stepIndex) => (stepIndex === index ? (value === "*" ? { kind: "any" } : { kind: "product", product: value }) : step));
}

function nextStep(steps: FunnelStepInput[], products: string[]): FunnelStepInput {
  const used = new Set(steps.map((step) => step.product).filter(Boolean));
  const product = products.find((item) => !used.has(item));
  return product ? { kind: "product", product } : { kind: "any" };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
