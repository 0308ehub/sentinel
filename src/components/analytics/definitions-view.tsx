"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExploreKind, ExploreMeasure, ExploreOptions, ExploreSpec, SegmentFilter } from "@/lib/analytics/explore-types";
import { blankFilter, filterLabel, specFromMetric, type Audience } from "@/lib/analytics/library";
import { kindLabel, measureLabel } from "@/lib/analytics/present";
import { useAnalyticsLibrary } from "@/stores/analytics-store";

const MEASURES: ExploreMeasure[] = ["uniques", "totals", "revenue", "aov", "frequency"];
const CHARTS: ExploreKind[] = ["line", "area", "bar", "metric", "table"];

interface Draft {
  name: string;
  description: string;
  filter: SegmentFilter;
  measure: ExploreMeasure;
  chart: ExploreKind;
}

export function DefinitionsView({ onOpen }: { onOpen: (spec: ExploreSpec) => void }) {
  const segments = useAnalyticsLibrary((state) => state.segments);
  const metrics = useAnalyticsLibrary((state) => state.metrics);
  const saveSegment = useAnalyticsLibrary((state) => state.saveSegment);
  const deleteSegment = useAnalyticsLibrary((state) => state.deleteSegment);
  const saveMetric = useAnalyticsLibrary((state) => state.saveMetric);
  const deleteMetric = useAnalyticsLibrary((state) => state.deleteMetric);
  const [options, setOptions] = useState<ExploreOptions | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [filter, setFilter] = useState<SegmentFilter>(blankFilter());
  const [segmentName, setSegmentName] = useState("");
  const [metricName, setMetricName] = useState("");
  const [measure, setMeasure] = useState<ExploreMeasure>("uniques");
  const [event, setEvent] = useState("");
  const [chart, setChart] = useState<ExploreKind>("line");
  const [segmentId, setSegmentId] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    fetch("/api/analytics/explore", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: ExploreOptions) => {
        if (body.products) setOptions(body);
      })
      .catch(() => undefined);
    fetch("/api/analytics/audience", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: Audience) => {
        if (Array.isArray(body.customers)) setAudience(body);
      })
      .catch(() => undefined);
  }, []);

  function saveNamedSegment() {
    const name = segmentName.trim();
    if (!name) return;
    saveSegment({ name, description: filterLabel(filter), filter });
    setSegmentName("");
    setFilter(blankFilter());
  }

  function saveNamedMetric() {
    const name = metricName.trim();
    if (!name) return;
    const linked = segments.find((segment) => segment.id === segmentId);
    saveMetric({
      name,
      description: "",
      measure,
      events: event ? [event] : [],
      segmentId: linked?.id ?? null,
      filter: linked?.filter ?? null,
      kind: chart,
    });
    setMetricName("");
  }

  async function draftWithModel() {
    const text = note.trim();
    if (!text) return;
    setDrafting(true);
    setDraftError("");
    setDraft(null);
    try {
      const res = await fetch("/api/analytics/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      });
      const body = (await res.json()) as Draft & { error?: string; hint?: string };
      if (!res.ok) throw new Error(body.hint || body.error || "Could not draft that.");
      setDraft(body);
    } catch (reason) {
      setDraftError(reason instanceof Error ? reason.message : "Could not draft that.");
    } finally {
      setDrafting(false);
    }
  }

  function keepDraft(as: "segment" | "metric") {
    if (!draft) return;
    if (as === "segment") {
      saveSegment({ name: draft.name, description: draft.description, filter: draft.filter });
    } else {
      saveMetric({
        name: draft.name,
        description: draft.description,
        measure: draft.measure,
        events: draft.filter.product ? [draft.filter.product] : [],
        segmentId: null,
        filter: draft.filter,
        kind: draft.chart,
      });
    }
    setDraft(null);
    setNote("");
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold">Definitions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name a group of customers, or a metric those customers are measured by. Charts use the warehouse, {options ? `${options.startDay} to ${options.endDay}` : "once it loads"}.
        </p>

        <section className="mt-8">
          <h3 className="text-sm font-medium">Segments</h3>
          <p className="mt-1 text-xs text-muted-foreground">Customers who match every condition you set.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Name">
              <input value={segmentName} onChange={(event) => setSegmentName(event.target.value)} className={inputClass} placeholder="Repeat card buyers" />
            </Field>
            <Field label="Bought">
              <select value={filter.product ?? ""} onChange={(event) => setFilter({ ...filter, product: event.target.value || null })} className={inputClass}>
                <option value="">Any product</option>
                {options?.products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Paid with">
              <select value={filter.payment ?? ""} onChange={(event) => setFilter({ ...filter, payment: event.target.value || null })} className={inputClass}>
                <option value="">Any method</option>
                {options?.payments.map((payment) => (
                  <option key={payment} value={payment}>
                    {payment}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="At least this many orders">
              <input
                type="number"
                min={1}
                max={30}
                value={filter.minOrders}
                onChange={(event) => setFilter({ ...filter, minOrders: Number(event.target.value) || 1 })}
                className={inputClass}
              />
            </Field>
            {audience && audience.customers.length > 0 && (
              <Field label="Specific customer">
                <select
                  value={filter.customerId ?? ""}
                  onChange={(event) => setFilter({ ...filter, customerId: event.target.value || null })}
                  className={inputClass}
                >
                  <option value="">Anyone</option>
                  {audience.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.label === customer.id ? customer.id : `${customer.label} · ${customer.id}`}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {audience && audience.cities.length > 0 && (
              <Field label="City">
                <select value={filter.city ?? ""} onChange={(event) => setFilter({ ...filter, city: event.target.value || null })} className={inputClass}>
                  <option value="">Any city</option>
                  {audience.cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {audience && audience.states.length > 0 && (
              <Field label="State">
                <select value={filter.state ?? ""} onChange={(event) => setFilter({ ...filter, state: event.target.value || null })} className={inputClass}>
                  <option value="">Any state</option>
                  {audience.states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <Button type="button" className="mt-3" size="sm" onClick={saveNamedSegment} disabled={!segmentName.trim()}>
            Save segment
          </Button>
          <DefinitionList
            empty="No saved segments."
            rows={segments.map((segment) => ({
              id: segment.id,
              title: segment.name,
              detail: filterLabel(segment.filter),
            }))}
            onDelete={deleteSegment}
          />
        </section>

        <section className="mt-10">
          <h3 className="text-sm font-medium">Metrics</h3>
          <p className="mt-1 text-xs text-muted-foreground">A measure, an event, and an optional segment.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Name">
              <input value={metricName} onChange={(event) => setMetricName(event.target.value)} className={inputClass} placeholder="Revenue from repeat buyers" />
            </Field>
            <Field label="Measure">
              <select value={measure} onChange={(event) => setMeasure(event.target.value as ExploreMeasure)} className={inputClass}>
                {MEASURES.map((item) => (
                  <option key={item} value={item}>
                    {measureLabel(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event">
              <select value={event} onChange={(event) => setEvent(event.target.value)} className={inputClass}>
                <option value="">All orders</option>
                {options?.products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Segment">
              <select value={segmentId} onChange={(event) => setSegmentId(event.target.value)} className={inputClass}>
                <option value="">Everyone</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chart">
              <select value={chart} onChange={(event) => setChart(event.target.value as ExploreKind)} className={inputClass}>
                {CHARTS.map((item) => (
                  <option key={item} value={item}>
                    {kindLabel(item)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="button" className="mt-3" size="sm" onClick={saveNamedMetric} disabled={!metricName.trim()}>
            Save metric
          </Button>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {metrics.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">No saved metrics.</li>}
            {metrics.map((metric) => (
              <li key={metric.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{metric.name}</p>
                  <p className="truncate text-muted-foreground">
                    {measureLabel(metric.measure)} · {kindLabel(metric.kind)} · {filterLabel(metric.filter)}
                  </p>
                </div>
                <button type="button" className="text-brand" onClick={() => onOpen(specFromMetric(metric, segments))}>
                  Open
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => deleteMetric(metric.id)} aria-label={`Delete ${metric.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <h3 className="text-sm font-medium">Ask Kismet to draft one</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Describe a group or a company metric in a sentence. The draft can only use products, payments, cities, and states that are in the warehouse.
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Revenue from customers who ordered at least 5 times"
            className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <Button type="button" className="mt-3" size="sm" onClick={() => void draftWithModel()} disabled={drafting || !note.trim()}>
            {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Draft
          </Button>
          {draftError && <p className="mt-2 text-xs text-destructive">{draftError}</p>}
          {draft && (
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-medium">{draft.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{draft.description}</p>
              <p className="mt-2 text-xs">
                {measureLabel(draft.measure)} · {kindLabel(draft.chart)} · {filterLabel(draft.filter)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={() => keepDraft("metric")}>
                  Save as metric
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => keepDraft("segment")}>
                  Save as segment
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DefinitionList({
  rows,
  empty,
  onDelete,
}: {
  rows: { id: string; title: string; detail: string }[];
  empty: string;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
      {rows.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">{empty}</li>}
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate text-muted-foreground">{row.detail}</p>
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onDelete(row.id)} aria-label={`Delete ${row.title}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const inputClass = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs";
