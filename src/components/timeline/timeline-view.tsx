"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, Loader2, Minus, Plus } from "lucide-react";
import type { AutopilotState, Experiment } from "@/lib/autopilot/types";

const LABEL = 224;
const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ZOOMS = [
  { days: 400, label: "Year" },
  { days: 200, label: "6 months" },
  { days: 100, label: "3 months" },
  { days: 42, label: "Month" },
] as const;

const TAGS = [
  { bg: "var(--tag-0-bg)", fg: "var(--tag-0-fg)" },
  { bg: "var(--tag-1-bg)", fg: "var(--tag-1-fg)" },
  { bg: "var(--tag-2-bg)", fg: "var(--tag-2-fg)" },
  { bg: "var(--tag-3-bg)", fg: "var(--tag-3-fg)" },
  { bg: "var(--tag-4-bg)", fg: "var(--tag-4-fg)" },
  { bg: "var(--tag-5-bg)", fg: "var(--tag-5-fg)" },
];

export function TimelineView() {
  const query = useQuery({
    queryKey: ["autopilot"],
    queryFn: async () => {
      const response = await fetch("/api/autopilot", { cache: "no-store" });
      return (await response.json()) as AutopilotState;
    },
  });
  const experiments = query.data?.experiments ?? [];
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [zoom, setZoom] = useState(2);
  const [kind, setKind] = useState<"all" | "experiment" | "fix">("all");
  const [page, setPage] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(0);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const scroller = useRef<HTMLDivElement>(null);
  const centerDay = useRef<number | null>(null);
  const pxRef = useRef(0);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const rangeStart = useMemo(() => new Date(year - 1, 11, 1), [year]);
  const totalDays = useMemo(() => daysBetween(rangeStart, new Date(year + 1, 1, 1)), [rangeStart, year]);
  const px = viewport > LABEL + 80 ? Math.max(2, (viewport - LABEL) / ZOOMS[zoom].days) : 6;
  useLayoutEffect(() => {
    pxRef.current = px;
  }, [px]);
  const timelineWidth = totalDays * px;

  const pages = useMemo(() => {
    const values = new Set<string>();
    for (const experiment of experiments) if (experiment.page) values.add(experiment.page);
    return [...values].sort();
  }, [experiments]);

  const rows = useMemo(() => {
    return experiments
      // Experiments are stored as kind "test" or "change"; everything that isn't a quick fix is an experiment.
      .filter((experiment) => kind === "all" || (kind === "fix" ? experiment.kind === "fix" : experiment.kind !== "fix"))
      .filter((experiment) => page === "all" || experiment.page === page)
      .map((experiment) => ({ experiment, span: barSpan(experiment, rangeStart, totalDays) }))
      .filter((row): row is { experiment: Experiment; span: BarSpan } => row.span != null)
      .sort((a, b) => a.span.startDay - b.span.startDay || a.experiment.title.localeCompare(b.experiment.title));
  }, [experiments, kind, page, rangeStart, totalDays]);

  const selected = rows.find((row) => row.experiment.id === selectedId) ?? null;
  const years = useMemo(() => {
    const values = new Set([nowYear - 1, nowYear, nowYear + 1]);
    for (const experiment of experiments) {
      const date = new Date(experiment.startedAt ?? experiment.createdAt);
      if (!Number.isNaN(date.getTime())) values.add(date.getFullYear());
    }
    return [...values].sort();
  }, [experiments, nowYear]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewport(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [query.isLoading]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let pending = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      pending += event.deltaY;
      if (Math.abs(pending) < 40) return;
      const direction = pending > 0 ? -1 : 1;
      pending = 0;
      if (pxRef.current > 0) centerDay.current = (el.scrollLeft + (el.clientWidth - LABEL) / 2) / pxRef.current;
      setZoom((current) => Math.max(0, Math.min(ZOOMS.length - 1, current + direction)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [query.isLoading]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || px <= 0) return;
    const day = centerDay.current ?? daysBetween(rangeStart, startOfDay(new Date()));
    el.scrollLeft = Math.max(0, day * px - (el.clientWidth - LABEL) / 2);
  }, [px, rangeStart, year]);

  function rememberCenter() {
    const el = scroller.current;
    const scale = pxRef.current;
    if (!el || scale <= 0) return;
    centerDay.current = (el.scrollLeft + (el.clientWidth - LABEL) / 2) / scale;
  }

  function changeYear(next: number) {
    const start = new Date(next - 1, 11, 1);
    const today = startOfDay(new Date());
    centerDay.current = next === today.getFullYear()
      ? daysBetween(start, today)
      : daysBetween(start, new Date(next, 0, 15));
    setYear(next);
  }

  function jumpToToday() {
    const today = startOfDay(new Date());
    if (today.getFullYear() !== year) {
      changeYear(today.getFullYear());
      return;
    }
    centerDay.current = daysBetween(rangeStart, today);
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, centerDay.current * px - (el.clientWidth - LABEL) / 2);
  }

  const todayIndex = mounted ? daysBetween(rangeStart, startOfDay(new Date())) : -1;
  const showToday = todayIndex >= 0 && todayIndex <= totalDays;
  const months = useMemo(() => monthMarks(rangeStart, totalDays), [rangeStart, totalDays]);
  const showDays = ZOOMS[zoom].days <= 42;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-[#1c1c1c]">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h1 className="text-lg font-medium">Experiment timeline</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={jumpToToday} className="h-8 rounded-md border border-[#e6e8ec] px-2.5 text-sm text-[#374151] hover:bg-[#f8fafc]">
            Today
          </button>
          <div className="flex h-8 items-center rounded-md border border-[#e6e8ec]">
            <button type="button" aria-label="Zoom out" onClick={() => { rememberCenter(); setZoom((value) => Math.max(0, value - 1)); }} className="grid h-8 w-8 place-items-center text-[#374151] hover:bg-[#f8fafc]">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-20 text-center text-xs text-[#374151]">{ZOOMS[zoom].label}</span>
            <button type="button" aria-label="Zoom in" onClick={() => { rememberCenter(); setZoom((value) => Math.min(ZOOMS.length - 1, value + 1)); }} className="grid h-8 w-8 place-items-center text-[#374151] hover:bg-[#f8fafc]">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="relative">
            <span className="sr-only">Year</span>
            <select
              value={year}
              onChange={(event) => changeYear(Number(event.target.value))}
              className="h-8 appearance-none rounded-md border border-[#e6e8ec] bg-white pl-3 pr-8 text-sm"
            >
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-[#6b7280]" />
          </label>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        <FilterChip active={kind === "all"} onClick={() => setKind("all")}>All</FilterChip>
        <FilterChip active={kind === "experiment"} onClick={() => setKind("experiment")}>Experiments</FilterChip>
        <FilterChip active={kind === "fix"} onClick={() => setKind("fix")}>Quick fixes</FilterChip>
        {pages.length > 0 && (
          <label className="relative">
            <span className="sr-only">Page</span>
            <select value={page} onChange={(event) => setPage(event.target.value)} className="h-8 appearance-none rounded-full border border-[#e6e8ec] bg-white pl-3 pr-8 text-sm">
              <option value="all">All pages</option>
              {pages.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-[#6b7280]" />
          </label>
        )}
        <p className="ml-auto hidden text-xs text-[#9aa0a8] lg:block">Drag to move. Pinch or ⌘-scroll to zoom.</p>
      </div>
      <div className="flex items-center gap-4 px-5 pb-2 text-[11px] text-[#6b7280]">
        <Legend swatch="bg-[#d6e4ff]" label="Running" />
        <Legend swatch="border border-[#e5e7eb] bg-white" label="Shipped" />
        <Legend swatch="bg-[#f8d0cb]" label="Needs a look" />
        <Legend swatch="border border-dashed border-[#a5b4fc] bg-[#eef2ff]" label="Planned" />
      </div>
      {query.isLoading ? (
        <p className="flex items-center px-5 text-sm text-[#6b7280]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading experiments…</p>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div
            ref={scroller}
            className="h-full cursor-grab overflow-auto active:cursor-grabbing"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const target = event.target as HTMLElement;
              if (target.closest("button, a, select, input")) return;
              const el = scroller.current;
              if (!el) return;
              drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
              el.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current || !scroller.current) return;
              scroller.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
              scroller.current.scrollTop = drag.current.top - (event.clientY - drag.current.y);
            }}
            onPointerUp={() => { drag.current = null; rememberCenter(); }}
            onPointerCancel={() => { drag.current = null; }}
          >
            <div style={{ width: LABEL + timelineWidth, minHeight: "100%" }}>
              <div className="sticky top-0 z-20 flex border-b border-[#eef0f3] bg-white">
                <div className="sticky left-0 z-30 w-56 shrink-0 bg-white" />
                <div className={`relative ${showDays ? "h-14" : "h-10"}`} style={{ width: timelineWidth }}>
                  {months.map((month) => (
                    <div key={month.key} className="absolute top-1 text-[11px] font-medium uppercase tracking-wide text-[#9aa0a8]" style={{ left: month.index * px }}>
                      {month.name}
                    </div>
                  ))}
                  {showDays && Array.from({ length: totalDays }, (_, index) => (
                    <div key={index} className="absolute bottom-0 overflow-hidden text-center text-[10px] leading-4 text-[#b0b6c0]" style={{ left: index * px, width: px }}>
                      {new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + index).getDate()}
                    </div>
                  ))}
                  {showToday && (
                    <div className="absolute top-1 z-10 -translate-x-1/2 rounded bg-[#111] px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ left: todayIndex * px }}>
                      Today
                    </div>
                  )}
                </div>
              </div>
              <div className="relative" style={{ minHeight: Math.max(360, rows.length * 48) }}>
                <div className="pointer-events-none absolute inset-y-0" style={{ left: LABEL, width: timelineWidth }}>
                  {months.map((month) => (
                    <div key={month.key} className="absolute inset-y-0 border-l border-[#f3f4f6]" style={{ left: month.index * px }} />
                  ))}
                  {showDays && Array.from({ length: totalDays }, (_, index) => (
                    <div key={index} className="absolute inset-y-0 border-l border-[#f7f8fa]" style={{ left: index * px }} />
                  ))}
                  {showToday && <div className="absolute inset-y-0 z-10 w-px bg-[#111]" style={{ left: todayIndex * px }} />}
                </div>
                {rows.length === 0 ? (
                  <p className="px-4 py-16 text-sm text-[#6b7280]" style={{ marginLeft: LABEL }}>
                    Experiments show up here once Kismet is shipping them. Zoom in to read a few weeks at a time, and drag to move through the year.
                  </p>
                ) : rows.map(({ experiment, span }) => {
                  const tone = barTone(experiment);
                  const tag = tagFor(experiment);
                  const active = experiment.id === selectedId;
                  const width = Math.max(span.days * px, 18);
                  return (
                    <div key={experiment.id} className={`flex h-14 items-center ${active ? "bg-[#f8fafc]" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(active ? null : experiment.id)}
                        className={`sticky left-0 z-10 flex h-full w-56 shrink-0 items-center gap-2 px-3 text-left ${active ? "bg-[#f8fafc]" : "bg-white"}`}
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold" style={{ background: tag.bg, color: tag.fg }}>{tag.letters}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{experiment.title}</span>
                          <span className="block truncate text-[11px] text-[#9aa0a8]">{shortRange(experiment)}</span>
                        </span>
                      </button>
                      <div className="relative h-full" style={{ width: timelineWidth }}>
                        <button
                          type="button"
                          title={`${experiment.title}: ${rangeText(experiment)}`}
                          onClick={() => setSelectedId(active ? null : experiment.id)}
                          className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-md px-2 text-[11px]"
                          style={{
                            left: span.startDay * px,
                            width,
                            background: tone.background,
                            color: tone.color,
                            border: `1px ${tone.dashed ? "dashed" : "solid"} ${tone.border}`,
                          }}
                        >
                          {width > 96 && <span className="truncate">{experiment.kind === "fix" ? "Quick fix" : experiment.page || "Experiment"}</span>}
                          {tone.mark && (
                            <span className="ml-auto grid h-4 w-4 shrink-0 place-items-center">
                              {tone.mark === "warn" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {selected && (
            <aside className="absolute right-4 top-3 z-30 w-72 rounded-2xl border border-[#eceef2] bg-white p-4 shadow-[0_12px_40px_rgba(16,24,40,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold leading-5">{selected.experiment.title}</h2>
                <button type="button" aria-label="Close details" onClick={() => setSelectedId(null)} className="text-[#9aa0a8] hover:text-[#111]">×</button>
              </div>
              <p className="mt-1 text-xs text-[#6b7280]">{selected.experiment.kind === "fix" ? "Quick fix" : "Experiment"} · {statusLabel(selected.experiment)}</p>
              <div className="mt-3 space-y-2">
                <Pill label="Scheduled" value={rangeText(selected.experiment)} />
                <Pill label="Duration" value={durationLabel(selected.experiment)} />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium">Test</p>
                {selected.experiment.metric && (
                  <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-[#6b7280]">{selected.experiment.metric}</span>
                    <Lift lift={selected.experiment.readout?.lift ?? null} />
                  </div>
                )}
                {selected.experiment.readout?.pValue != null && (
                  <p className="mt-1 text-right text-xs text-[#9aa0a8]">p = {selected.experiment.readout.pValue < 0.001 ? "< 0.001" : selected.experiment.readout.pValue.toFixed(3)}</p>
                )}
                {!selected.experiment.readout && !selected.experiment.metric && <p className="mt-2 text-xs text-[#9aa0a8]">No result yet.</p>}
              </div>
              {selected.experiment.hypothesis && <p className="mt-3 text-xs leading-5 text-[#374151]">{selected.experiment.hypothesis}</p>}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-sm ${active ? "bg-[#111] text-white" : "border border-[#e6e8ec] text-[#374151] hover:bg-[#f8fafc]"}`}
    >
      {children}
    </button>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-4 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-[#6b7280]">{label}</span>
      <span className="truncate rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs text-[#374151]">{value}</span>
    </div>
  );
}

function Lift({ lift }: { lift: number | null }) {
  if (lift == null) return <span className="text-xs text-[#9aa0a8]">Collecting</span>;
  const positive = lift > 0;
  const flat = Math.abs(lift) < 0.005;
  return (
    <span className={`font-medium ${flat ? "text-[#6b7280]" : positive ? "text-[#17803d]" : "text-[#b42318]"}`}>
      {positive ? "+" : ""}{(lift * 100).toFixed(1)}%
    </span>
  );
}

interface BarSpan { startDay: number; days: number }

function barSpan(experiment: Experiment, rangeStart: Date, totalDays: number): BarSpan | null {
  const start = startOfDay(new Date(experiment.startedAt ?? experiment.createdAt));
  if (Number.isNaN(start.getTime())) return null;
  const end = startOfDay(endDate(experiment, start));
  const startDay = daysBetween(rangeStart, start);
  const endDay = daysBetween(rangeStart, end);
  if (endDay < 0 || startDay > totalDays) return null;
  const from = Math.max(0, startDay);
  const to = Math.min(totalDays, Math.max(endDay, startDay + 1));
  return { startDay: from, days: Math.max(1, to - from) };
}

function endDate(experiment: Experiment, start: Date): Date {
  if (experiment.endedAt) return new Date(experiment.endedAt);
  const days = experiment.estimate?.days;
  const length = Number.isFinite(days) && days && days > 0 ? Math.min(days, 120) : experiment.status === "running" ? 14 : 21;
  return new Date(start.getTime() + length * DAY);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date): number {
  const from = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const to = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((to - from) / DAY);
}

function monthMarks(start: Date, totalDays: number): { key: string; name: string; index: number }[] {
  const marks: { key: string; name: string; index: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor < start) cursor.setMonth(cursor.getMonth() + 1);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + totalDays);
  while (cursor <= end) {
    marks.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      name: MONTHS[cursor.getMonth()],
      index: daysBetween(start, cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return marks;
}

function barTone(experiment: Experiment): { background: string; color: string; border: string; dashed: boolean; mark: "check" | "warn" | null } {
  if (experiment.status === "rolled_out" || experiment.readout?.verdict === "won") {
    return { background: "var(--timeline-won)", color: "var(--timeline-won-fg)", border: "var(--border)", dashed: false, mark: "check" };
  }
  if (experiment.readout?.verdict === "flat") {
    return { background: "var(--timeline-flat)", color: "var(--timeline-flat-fg)", border: "transparent", dashed: false, mark: null };
  }
  if (experiment.status === "stopped" || experiment.status === "failed" || experiment.readout?.verdict === "lost") {
    return { background: "var(--timeline-lost)", color: "var(--timeline-lost-fg)", border: "transparent", dashed: false, mark: "warn" };
  }
  if (experiment.status === "running" || experiment.status === "awaiting_rollout" || experiment.status === "rolling_out") {
    return { background: "var(--timeline-run)", color: "var(--timeline-run-fg)", border: "transparent", dashed: false, mark: "check" };
  }
  if (experiment.status === "queued") {
    return { background: "var(--timeline-flat)", color: "var(--timeline-flat-fg)", border: "transparent", dashed: false, mark: null };
  }
  return { background: "var(--timeline-plan)", color: "var(--timeline-plan-fg)", border: "var(--timeline-plan-border)", dashed: true, mark: null };
}

function tagFor(experiment: Experiment): { letters: string; bg: string; fg: string } {
  const source = experiment.page.replace(/^\//, "");
  const slug = source.split("/").filter(Boolean).pop() ?? "";
  const letters = (slug.slice(0, 2) || (experiment.kind === "fix" ? "fx" : "ex")).toUpperCase();
  let hash = 0;
  for (const char of source || experiment.id) hash = (hash + char.charCodeAt(0)) % TAGS.length;
  return { letters, ...TAGS[hash] };
}

function statusLabel(experiment: Experiment): string {
  if (experiment.status === "rolled_out") return "Shipped";
  if (experiment.status === "running") return "Running";
  if (experiment.status === "awaiting_approval") return "Waiting for approval";
  if (experiment.status === "awaiting_rollout") return "Ready to ship";
  if (experiment.status === "rolling_out") return "Rolling out";
  return experiment.status.replaceAll("_", " ");
}

function shortRange(experiment: Experiment): string {
  const start = new Date(experiment.startedAt ?? experiment.createdAt);
  const end = endDate(experiment, start);
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${format(start)} – ${format(end)}`;
}

function rangeText(experiment: Experiment): string {
  const start = new Date(experiment.startedAt ?? experiment.createdAt);
  const end = endDate(experiment, start);
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${format(start)} – ${format(end)}`;
}

function durationLabel(experiment: Experiment): string {
  const start = new Date(experiment.startedAt ?? experiment.createdAt);
  const end = endDate(experiment, start);
  const days = Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY));
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}
