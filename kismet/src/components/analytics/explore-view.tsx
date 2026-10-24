"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Pin, Plus, X } from "lucide-react";
import { ChartCanvas } from "@/components/analytics/chart-canvas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExploreKind, ExploreMeasure, ExploreOptions, ExploreResult, ExploreSpec, FunnelStepInput, SegmentFilter } from "@/lib/analytics/explore-types";
import { blankFilter, filterLabel, type Audience } from "@/lib/analytics/library";
import { chartTitle, measureLabel } from "@/lib/analytics/present";
import { useAnalyticsLibrary } from "@/stores/analytics-store";

function funnelDefaults(products: string[]): FunnelStepInput[] {
  const steps: FunnelStepInput[] = [{ kind: "any" }];
  if (products[0]) steps.push({ kind: "product", product: products[0] });
  if (products[1]) steps.push({ kind: "product", product: products[1] });
  if (steps.length < 2) steps.push({ kind: "any" });
  return steps;
}

const COLORS = ["#0571d3", "#16803c", "#7c3aed", "#d97706", "#db2777", "#0f766e", "#111111", "#ca8a04"];

const MEASURES: { id: ExploreMeasure; label: string }[] = [
  { id: "uniques", label: "Uniques" },
  { id: "totals", label: "Event totals" },
  { id: "revenue", label: "Revenue" },
  { id: "aov", label: "Average order value" },
  { id: "frequency", label: "Orders per customer" },
];

const KINDS: { id: ExploreKind; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "bar", label: "Bar" },
  { id: "metric", label: "Number" },
  { id: "table", label: "Table" },
  { id: "funnel", label: "Funnel" },
];

export function ExploreView({ preset }: { preset?: ExploreSpec | null }) {
  const [options, setOptions] = useState<ExploreOptions | null>(null);
  const [spec, setSpec] = useState<ExploreSpec | null>(null);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [notice, setNotice] = useState("");
  const segments = useAnalyticsLibrary((state) => state.segments);
  const saveMetric = useAnalyticsLibrary((state) => state.saveMetric);
  const ensureDashboard = useAnalyticsLibrary((state) => state.ensureDashboard);
  const addCard = useAnalyticsLibrary((state) => state.addCard);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/explore", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as ExploreOptions & { hint?: string; error?: string };
        if (!res.ok) throw new Error(body.hint || body.error || "Could not load events.");
        if (cancelled) return;
        setOptions(body);
        setSpec((current) => current ?? {
          kind: "line",
          measure: "uniques",
          events: body.products.slice(0, 4),
          lastDays: null,
          breakdown: "product",
          steps: funnelDefaults(body.products),
          withinDays: null,
          segment: null,
        });
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

  useEffect(() => {
    fetch("/api/analytics/audience", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: Audience) => {
        if (Array.isArray(body.customers)) setAudience(body);
      })
      .catch(() => undefined);
  }, []);

  const presetKey = preset ? JSON.stringify(preset) : "";
  useEffect(() => {
    if (preset) setSpec(preset);
    // presetKey is the stable identity of the chart a definition asked to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

  const specKey = spec ? JSON.stringify(spec) : "";

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/analytics/explore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: specKey,
    })
      .then(async (res) => {
        const body = (await res.json()) as ExploreResult & { hint?: string; error?: string };
        if (!res.ok) throw new Error(body.hint || body.error || "The chart query failed.");
        if (!cancelled) setResult(body);
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
  }, [spec, specKey]);

  const update = (patch: Partial<ExploreSpec>) => setSpec((current) => (current ? { ...current, ...patch } : current));

  if (!spec || !options) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" suppressHydrationWarning>
        <Loader2 className="h-4 w-4 animate-spin" />
        {error || "Loading chart…"}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-border p-3">
        <p className="text-xs text-muted-foreground">Chart</p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {KINDS.map((kind) => (
            <Choice key={kind.id} active={spec.kind === kind.id} onClick={() => update({ kind: kind.id })} label={kind.label} />
          ))}
        </div>

        {spec.kind === "funnel" ? (
          <FunnelControls spec={spec} products={options.products} onChange={update} />
        ) : (
          <EventControls
            spec={spec}
            products={options.products}
            adding={adding}
            setAdding={setAdding}
            onChange={update}
          />
        )}

        {spec.kind !== "funnel" && (
          <section className="mt-5">
            <p className="text-xs text-muted-foreground">Measured as</p>
            <div className="mt-2 grid grid-cols-1 gap-1">
              {MEASURES.map((measure) => (
                <Choice
                  key={measure.id}
                  active={spec.measure === measure.id}
                  onClick={() => update({ measure: measure.id })}
                  label={measure.label}
                />
              ))}
            </div>
          </section>
        )}

        {spec.kind === "bar" && (
          <section className="mt-5">
            <p className="text-xs text-muted-foreground">Breakdown</p>
            <div className="mt-2 flex gap-1">
              <Choice active={spec.breakdown === "product"} onClick={() => update({ breakdown: "product" })} label="Product" />
              <Choice active={spec.breakdown === "payment"} onClick={() => update({ breakdown: "payment" })} label="Payment" />
            </div>
          </section>
        )}

        <SegmentControls
            spec={spec}
            options={options}
            audience={audience}
            segments={segments.map((segment) => ({ id: segment.id, name: segment.name, filter: segment.filter }))}
            onChange={update}
          />

        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Events are purchases in samples.bakehouse, {options.startDay} to {options.endDay}.
        </p>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{chartTitle(spec)}</h2>
            <p className="text-[11px] text-muted-foreground">
              {loading ? "Running on Databricks…" : result ? `${result.startDay || options.startDay} to ${result.endDay || options.endDay}` : error}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Choice active={spec.lastDays == null} onClick={() => update({ lastDays: null })} label="All" />
            <Choice active={spec.lastDays === 7} onClick={() => update({ lastDays: 7 })} label="7d" />
            <Choice active={spec.lastDays === 3} onClick={() => update({ lastDays: 3 })} label="3d" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const id = ensureDashboard();
                addCard(id, { title: chartTitle(spec), spec });
                setNotice("Pinned to the board.");
              }}
            >
              <Pin className="h-3 w-3" />
              Pin
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                saveMetric({
                  name: chartTitle(spec),
                  description: filterLabel(spec.segment),
                  measure: spec.measure,
                  events: spec.events.filter((event) => event !== "*"),
                  segmentId: null,
                  filter: spec.segment ?? null,
                  kind: spec.kind === "funnel" ? "line" : spec.kind,
                });
                setNotice("Saved as a metric.");
              }}
            >
              Save metric
            </Button>
          </div>
        </div>

        {notice && <p className="mt-3 text-xs text-muted-foreground">{notice}</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {result && <ChartCanvas result={result} measure={spec.measure} />}
      </div>
    </div>
  );
}

function EventControls({
  spec,
  products,
  adding,
  setAdding,
  onChange,
}: {
  spec: ExploreSpec;
  products: string[];
  adding: boolean;
  setAdding: (open: boolean) => void;
  onChange: (patch: Partial<ExploreSpec>) => void;
}) {
  const remaining = products.filter((product) => !spec.events.includes(product));
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">Events</p>
      <div className="mt-2 space-y-1">
        {spec.events.length === 0 && (
          <div className="rounded-md border border-border px-2 py-1.5 text-xs">All orders</div>
        )}
        {spec.events.map((event, index) => (
          <div key={event} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{event === "*" ? "All orders" : event}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ events: spec.events.filter((item) => item !== event) })}
              aria-label={`Remove ${event}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {remaining.length > 0 && (
        <div className="relative mt-2">
          <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => setAdding(!adding)}>
            <Plus className="h-3 w-3" />
            Add event
          </Button>
          {adding && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background p-1 shadow-sm">
              {remaining.map((product) => (
                <button
                  key={product}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onChange({ events: [...spec.events.filter((event) => event !== "*"), product] });
                    setAdding(false);
                  }}
                >
                  {product}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FunnelControls({
  spec,
  products,
  onChange,
}: {
  spec: ExploreSpec;
  products: string[];
  onChange: (patch: Partial<ExploreSpec>) => void;
}) {
  const setStep = (index: number, value: string) => {
    const steps = spec.steps.map((step, stepIndex) =>
      stepIndex === index ? (value === "*" ? { kind: "any" as const } : { kind: "product" as const, product: value }) : step
    );
    onChange({ steps });
  };
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">Events, in this order</p>
      <div className="mt-2 space-y-1">
        {spec.steps.map((step, index) => (
          <div key={`${step.kind}-${step.product ?? "any"}-${index}`} className="flex items-center gap-2">
            <span className="w-4 text-xs text-muted-foreground">{index + 1}</span>
            <select
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
              value={step.kind === "any" ? "*" : step.product}
              onChange={(event) => setStep(index, event.target.value)}
            >
              <option value="*">Any order</option>
              {products.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
            {spec.steps.length > 2 && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange({ steps: spec.steps.filter((_, stepIndex) => stepIndex !== index) })}
                aria-label="Remove step"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {spec.steps.length < 6 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full text-xs"
          onClick={() => onChange({ steps: [...spec.steps, nextStep(spec.steps, products)] })}
        >
          <Plus className="h-3 w-3" />
          Add step
        </Button>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Completed within</p>
      <div className="mt-2 flex gap-1">
        <Choice active={spec.withinDays === 1} onClick={() => onChange({ withinDays: 1 })} label="1 day" />
        <Choice active={spec.withinDays === 7} onClick={() => onChange({ withinDays: 7 })} label="7 days" />
        <Choice active={spec.withinDays == null} onClick={() => onChange({ withinDays: null })} label="Any time" />
      </div>
    </section>
  );
}


function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function nextStep(steps: FunnelStepInput[], products: string[]): FunnelStepInput {
  const used = new Set(steps.map((step) => step.product).filter(Boolean));
  const product = products.find((item) => !used.has(item)) ?? products[0];
  return product ? { kind: "product", product } : { kind: "any" };
}

function SegmentControls({
  spec,
  options,
  audience,
  segments,
  onChange,
}: {
  spec: ExploreSpec;
  options: ExploreOptions;
  audience: Audience | null;
  segments: { id: string; name: string; filter: SegmentFilter }[];
  onChange: (patch: Partial<ExploreSpec>) => void;
}) {
  const current = spec.segment ?? blankFilter();
  const matched = segments.find((segment) => JSON.stringify(segment.filter) === JSON.stringify(current))?.id ?? "";
  const setFilter = (patch: Partial<SegmentFilter>) => onChange({ segment: { ...blankFilter(), ...current, ...patch } });
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">Segment</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{filterLabel(spec.segment)}</p>
      <select
        className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
        value={matched}
        onChange={(event) => {
          const segment = segments.find((item) => item.id === event.target.value);
          onChange({ segment: segment ? segment.filter : null });
        }}
      >
        <option value="">Everyone</option>
        {segments.map((segment) => (
          <option key={segment.id} value={segment.id}>
            {segment.name}
          </option>
        ))}
      </select>
      <label className="mt-3 block text-[11px] text-muted-foreground">
        Bought
        <select
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={current.product ?? ""}
          onChange={(event) => setFilter({ product: event.target.value || null })}
        >
          <option value="">Any product</option>
          {options.products.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-[11px] text-muted-foreground">
        Paid with
        <select
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={current.payment ?? ""}
          onChange={(event) => setFilter({ payment: event.target.value || null })}
        >
          <option value="">Any method</option>
          {options.payments.map((payment) => (
            <option key={payment} value={payment}>
              {payment}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-[11px] text-muted-foreground">
        At least this many orders
        <input
          type="number"
          min={1}
          max={30}
          value={current.minOrders}
          onChange={(event) => setFilter({ minOrders: Number(event.target.value) || 1 })}
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
        />
      </label>
      {audience && audience.customers.length > 0 && (
        <label className="mt-2 block text-[11px] text-muted-foreground">
          Specific customer
          <select
            className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={current.customerId ?? ""}
            onChange={(event) => setFilter({ customerId: event.target.value || null })}
          >
            <option value="">Anyone</option>
            {audience.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label === customer.id ? customer.id : `${customer.label}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {audience && audience.cities.length > 0 && (
        <label className="mt-2 block text-[11px] text-muted-foreground">
          City
          <select
            className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={current.city ?? ""}
            onChange={(event) => setFilter({ city: event.target.value || null })}
          >
            <option value="">Any city</option>
            {audience.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      )}
      {audience && audience.states.length > 0 && (
        <label className="mt-2 block text-[11px] text-muted-foreground">
          State
          <select
            className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={current.state ?? ""}
            onChange={(event) => setFilter({ state: event.target.value || null })}
          >
            <option value="">Any state</option>
            {audience.states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

