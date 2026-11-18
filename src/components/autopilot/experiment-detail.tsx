"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { BuildLive } from "@/components/autopilot/build-live";
import { CodeChange } from "@/components/autopilot/code-change";
import { Button } from "@/components/ui/button";
import type { ArmResult, Experiment, Readout, Signal } from "@/lib/autopilot/types";

const DECISION_VISITORS = 200;
const PANEL_KEY = "kismet-experiment-panel-width";
const DEFAULT_PANEL_WIDTH = 360;
const panelListeners = new Set<() => void>();

function clampPanelWidth(width: number) {
  return Math.min(600, Math.max(280, Math.round(width)));
}

function readPanelWidth() {
  try {
    const width = Number(localStorage.getItem(PANEL_KEY));
    return Number.isFinite(width) && width > 0 ? clampPanelWidth(width) : DEFAULT_PANEL_WIDTH;
  } catch {
    return DEFAULT_PANEL_WIDTH;
  }
}

function writePanelWidth(width: number) {
  try {
    localStorage.setItem(PANEL_KEY, String(clampPanelWidth(width)));
  } catch {
    // Storage can be blocked; resizing still works for the current pointer interaction.
  }
  panelListeners.forEach((listener) => listener());
}

function subscribePanelWidth(listener: () => void) {
  panelListeners.add(listener);
  return () => panelListeners.delete(listener);
}

interface DailyVisitors {
  day: string;
  control: number;
  treatment: number;
}

export function ExperimentDetail({
  experiment,
  signal,
  suggested,
  busy,
  onBack,
  onApprove,
  onReject,
  onCancel,
  onRollout,
  onStop,
  onApproveCleanup,
  onDismissCleanup,
  onStart,
  onDismissSignal,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  suggested: boolean;
  busy: string | null;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRollout: () => void;
  onStop: () => void;
  onApproveCleanup: () => void;
  onDismissCleanup: () => void;
  onStart: () => void;
  onDismissSignal: () => void;
}) {
  const title = experiment?.title ?? signal?.title ?? "Experiment";
  const readout = experiment?.readout ?? null;
  const control = readout?.arms.find((arm) => arm.arm === "control") ?? null;
  const treatment = readout?.arms.find((arm) => arm.arm === "treatment") ?? null;
  const visitors = (control?.visitors ?? 0) + (treatment?.visitors ?? 0);
  const status = experiment ? statusLabel(experiment.status) : "Suggested";
  const runningLook = !suggested && experiment != null;
  const names = armNames(experiment, signal);
  const decisions = (
    <Decisions
      experiment={experiment}
      signal={signal}
      busy={busy}
      onApprove={onApprove}
      onReject={onReject}
      onCancel={onCancel}
      onRollout={onRollout}
      onStop={onStop}
      onApproveCleanup={onApproveCleanup}
      onDismissCleanup={onDismissCleanup}
      onStart={onStart}
      onDismissSignal={onDismissSignal}
    />
  );
  const panelWidth = useSyncExternalStore(subscribePanelWidth, readPanelWidth, () => DEFAULT_PANEL_WIDTH);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = panelWidth;
    const move = (moveEvent: PointerEvent) => writePanelWidth(startWidth + moveEvent.clientX - startX);
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
  }

  return (
    <div className="flex h-full min-h-0 bg-white text-[#1c1c1c]">
      <aside className="flex shrink-0 flex-col gap-4 overflow-auto px-4 py-4" style={{ width: panelWidth }}>
        <button type="button" onClick={onBack} className="text-left text-xs text-[#2563eb] hover:underline">
          ‹ Experiments
        </button>
        <div>
          <h1 className="text-xl leading-tight text-[#111827]">{title}</h1>
          <p className="mt-2 text-xs text-[#6b7280]">
            A/B Test · <span className={status === "Running" ? "text-[#1f9d55]" : "text-[#374151]"}>{status}</span>
          </p>
          {suggested && (
            <p className="mt-2 inline-flex rounded border border-[#c7d7fe] bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2563eb]">
              Suggested
            </p>
          )}
        </div>
        <dl className="space-y-3 text-xs">
          <Fact label="Last publish" value={formatDay(experiment?.startedAt ?? experiment?.createdAt ?? signal?.updatedAt ?? null)} />
          <Fact label="Days running" value={daysRunning(experiment)} />
          <Fact label="Audiences" value="Everyone" />
          <Fact label="Experiment visitors" value={visitors ? visitors.toLocaleString("en-US") : "—"} />
        </dl>
        <Autonomous experiment={experiment} signal={signal} suggested={suggested} />
      </aside>
      <div
        role="separator"
        aria-label="Resize details panel"
        aria-orientation="vertical"
        aria-valuemin={280}
        aria-valuemax={600}
        aria-valuenow={panelWidth}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            writePanelWidth(panelWidth + (event.key === "ArrowLeft" ? -24 : 24));
          }
        }}
        className="group relative w-1.5 shrink-0 cursor-col-resize border-x border-transparent outline-none hover:bg-[#dbe7ff] focus:bg-[#dbe7ff]"
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#e6e8ec] group-hover:bg-[#2563eb] group-focus:bg-[#2563eb]" />
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        <MainPanel
          experiment={experiment}
          signal={signal}
          readout={readout}
          control={control}
          treatment={treatment}
          names={names}
          muted={!runningLook}
          showChart={runningLook}
          decisions={decisions}
        />
      </div>
    </div>
  );
}

/** True when there is code to look at: a pull request, a pushed branch, or a stored draft. */
function hasCodeChange(experiment: Experiment | null): boolean {
  return Boolean(experiment && (experiment.prNumber || experiment.branch || experiment.draftPath));
}

/**
 * The results and the code change on one page, never in tabs. Before there are results the change
 * leads, because that is what the person is deciding on; once the experiment runs, results lead.
 * The decision buttons sit right above the code they act on.
 */
function MainPanel(props: {
  experiment: Experiment | null;
  signal: Signal | null;
  readout: Readout | null;
  control: ArmResult | null;
  treatment: ArmResult | null;
  names: { control: string; treatment: string };
  muted: boolean;
  showChart: boolean;
  decisions: React.ReactNode;
}) {
  const { experiment, decisions, ...results } = props;
  const hasChange = hasCodeChange(experiment);
  const hasResults = Boolean(
    props.readout || experiment?.status === "running" || experiment?.status === "awaiting_rollout" || experiment?.endedAt,
  );
  const change = experiment && hasChange ? (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e8ec] px-4 py-3">
        <h2 className="text-sm font-medium text-[#111827]">Code change</h2>
        {decisions}
      </div>
      <CodeChange key={experiment.id} experiment={experiment} />
    </section>
  ) : null;

  if (change && !hasResults) {
    return (
      <div>
        {change}
        <p className="border-t border-[#e6e8ec] px-4 py-3 text-xs text-[#6b7280]">
          Results appear here once the experiment is live and counting visitors.
        </p>
      </div>
    );
  }
  return (
    <div>
      {!change && decisions && <div className="flex justify-end border-b border-[#e6e8ec] px-4 py-3">{decisions}</div>}
      <ResultsCanvas experiment={experiment} {...results} />
      {change && <div className="border-t border-[#e6e8ec]">{change}</div>}
    </div>
  );
}

function Autonomous({
  experiment,
  signal,
  suggested,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  suggested: boolean;
}) {
  return (
    <div className="space-y-3 border-t border-[#e6e8ec] pt-3 text-xs">
      <p className="font-medium text-[#374151]">Kismet</p>
      {signal && (
        <div className="text-[#374151]">
          <p>
            {`Suggested from ${signal.evidence.length} ${signal.evidence.length === 1 ? "piece" : "pieces"} of evidence${signal.area ? ` in ${signal.area}` : ""}. ${signal.problem}`}
          </p>
          {signal.staleEvidence > 0 && <p className="mt-1">{signal.staleEvidence} older items not counted</p>}
        </div>
      )}
      {experiment?.hypothesis && <p>{experiment.hypothesis}</p>}
      {experiment && <p className="text-[#374151]">{experiment.metric}</p>}
      {experiment?.guardrail && <p className="text-[#374151]">Guardrail: {experiment.guardrail}</p>}
      {suggested && !experiment && (
        <p className="text-[#374151]">Approving this lets Kismet design the change, the metric, and the guardrail.</p>
      )}
      {experiment?.status === "building" && (
        <p className="text-[#374151]">Kismet is writing the change. Approval waits until that pull request is ready.</p>
      )}
      {experiment?.overlap && <p className="text-[#374151]">{experiment.overlap}</p>}
      {experiment?.note && <p className="text-[#374151]">{experiment.note}</p>}
      {experiment?.readout?.verdict && experiment.readout.verdict !== "collecting" && (
        <p>Kismet calls this {experiment.readout.verdict}.</p>
      )}
      {experiment?.status === "building" && experiment.coderSessionId && <BuildLive experimentId={experiment.id} />}
      <Links experiment={experiment} />
    </div>
  );
}

function Decisions({
  experiment,
  signal,
  busy,
  onApprove,
  onReject,
  onCancel,
  onRollout,
  onStop,
  onApproveCleanup,
  onDismissCleanup,
  onStart,
  onDismissSignal,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  busy: string | null;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRollout: () => void;
  onStop: () => void;
  onApproveCleanup: () => void;
  onDismissCleanup: () => void;
  onStart: () => void;
  onDismissSignal: () => void;
}) {
  const id = experiment?.id ?? signal?.id ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2 empty:hidden">
        {!experiment && signal && (
          <>
            <Button size="sm" className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={onStart} disabled={busy !== null}>
              {busy === signal.id && <Loader2 className="animate-spin" />}
              Approve suggestion
            </Button>
            <Button size="sm" variant="outline" onClick={onDismissSignal} disabled={busy !== null}>
              Dismiss
            </Button>
          </>
        )}
        {experiment?.status === "awaiting_approval" && (
          <>
            <Button size="sm" className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={onApprove} disabled={busy !== null}>
              {busy === id + "approve" && <Loader2 className="animate-spin" />}
              Approve & ship
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy !== null}>
              Discard change
            </Button>
          </>
        )}
        {experiment?.status === "building" && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy !== null}>
            Stop and discard
          </Button>
        )}
        {experiment?.status === "awaiting_rollout" && (
          <>
            <Button size="sm" className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={onRollout} disabled={busy !== null}>
              Roll out to everyone
            </Button>
            <Button size="sm" variant="outline" onClick={onStop} disabled={busy !== null}>
              Turn off
            </Button>
          </>
        )}
        {experiment?.status === "running" && (
          <Button size="sm" variant="outline" onClick={onStop} disabled={busy !== null}>
            Turn off
          </Button>
        )}
        {experiment?.cleanup?.status === "awaiting" && (
          <>
            <Button size="sm" onClick={onApproveCleanup} disabled={busy !== null}>
              Approve cleanup
            </Button>
            <Button size="sm" variant="outline" onClick={onDismissCleanup} disabled={busy !== null}>
              Keep the switch
            </Button>
          </>
        )}
    </div>
  );
}

function Links({ experiment }: { experiment: Experiment | null }) {
  if (!experiment) return null;
  const cleanup = experiment.cleanup;
  return (
    <div className="space-y-1 text-[#2563eb]">
      {experiment.buildUrl && (
        <a className="flex items-center gap-1 hover:underline" href={experiment.buildUrl} target="_blank" rel="noreferrer">
          Watch the build <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {experiment.prUrl && (
        <a className="flex items-center gap-1 hover:underline" href={experiment.prUrl} target="_blank" rel="noreferrer">
          Pull request #{experiment.prNumber} <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {cleanup?.status === "awaiting" && cleanup.prUrl && (
        <a className="flex items-center gap-1 hover:underline" href={cleanup.prUrl} target="_blank" rel="noreferrer">
          Cleanup pull request #{cleanup.prNumber} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function ResultsCanvas({
  experiment,
  signal,
  readout,
  control,
  treatment,
  names,
  muted,
  showChart,
}: {
  experiment: Experiment | null;
  signal: Signal | null;
  readout: Readout | null;
  control: ArmResult | null;
  treatment: ArmResult | null;
  names: { control: string; treatment: string };
  muted: boolean;
  showChart: boolean;
}) {
  const compare = control && treatment ? rateInterval(control, treatment) : null;
  const start = experiment?.startedAt ?? experiment?.createdAt ?? signal?.createdAt ?? null;
  return (
    <div className="text-[#374151]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-[#e6e8ec] px-4 py-3 text-xs text-[#6b7280]">
        <ToolbarLabel label="Date range" value={rangeLabel(start)} />
        <ToolbarLabel label="Segment" value="All visitors" />
        <ToolbarLabel label="Baseline" value={names.control} />
        <ToolbarLabel label="Metric" value={experiment?.metric || "Conversion"} />
        {muted && <span className="ml-auto text-[11px]">Results stay hidden until this suggestion is approved.</span>}
      </div>
      <div className="px-4 py-4">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-xs text-[#6b7280]">
              <th className="pb-2 font-medium" />
              <th className="pb-2 font-medium">Total conversions</th>
              <th className="pb-2 font-medium">Conversions per visitor</th>
              <th className="pb-2 font-medium">Improvement</th>
              <th className="pb-2 font-medium">Confidence interval</th>
              <th className="pb-2 text-right font-medium">Statistical significance</th>
            </tr>
          </thead>
          <tbody>
            <ResultRow
              name={names.control}
              color="#5c6570"
              arm={control}
              improvement={null}
              interval={null}
              significance="Baseline"
              remaining={null}
            />
            <ResultRow
              name={names.treatment}
              color="#db2777"
              arm={treatment}
              improvement={compare?.lift ?? readout?.lift ?? null}
              interval={compare}
              significance={significanceLabel(readout?.pValue ?? null)}
              remaining={treatment ? Math.max(0, DECISION_VISITORS - treatment.visitors) : null}
            />
          </tbody>
        </table>
        {readout && readout.syntheticShare > 0 && (
          <p className="mt-2 text-xs text-[#6b7280]">{Math.round(readout.syntheticShare * 100)}% of this traffic is synthetic.</p>
        )}
      </div>
      {showChart && experiment && <VisitorChart experimentId={experiment.id} startedAt={experiment.startedAt} names={names} />}
      {muted && (
        <div className="mx-4 mb-6 rounded border border-dashed border-[#e1e4e8] px-4 py-8 text-center text-sm">
          Kismet will start counting visitors after you approve this experiment.
        </div>
      )}
    </div>
  );
}

function ResultRow({
  name,
  color,
  arm,
  improvement,
  interval,
  significance,
  remaining,
}: {
  name: string;
  color: string;
  arm: ArmResult | null;
  improvement: number | null;
  interval: { low: number; high: number; lift: number } | null;
  significance: string;
  remaining: number | null;
}) {
  const rate = arm && arm.visitors > 0 ? arm.conversions / arm.visitors : null;
  return (
    <tr className="border-t border-[#eef0f3]">
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="font-medium">{name}</span>
        </span>
      </td>
      <td className="py-3">
        <div>{arm ? arm.conversions.toLocaleString("en-US") : "—"}</div>
        <div className="text-xs text-[#9aa0a8]">{arm ? `${arm.visitors.toLocaleString("en-US")} visitors` : ""}</div>
      </td>
      <td className="py-3 tabular-nums">{rate == null ? "—" : rate.toFixed(3)}</td>
      <td className="py-3 tabular-nums">{improvement == null ? "—" : signedPercent(improvement)}</td>
      <td className="py-3">{interval ? <IntervalMark lift={interval.lift} low={interval.low} high={interval.high} /> : "—"}</td>
      <td className="py-3 text-right">
        <div>{significance}</div>
        {remaining != null && remaining > 0 && significance !== "Baseline" && (
          <div className="text-xs text-[#9aa0a8]">{remaining.toLocaleString("en-US")} visitors remaining</div>
        )}
      </td>
    </tr>
  );
}

function IntervalMark({ lift, low, high }: { lift: number; low: number; high: number }) {
  const bound = Math.max(Math.abs(low), Math.abs(high), Math.abs(lift), 0.01) * 1.4;
  const place = (value: number) => `${Math.min(98, Math.max(2, ((value + bound) / (2 * bound)) * 100))}%`;
  const left = place(Math.min(low, high));
  const right = place(Math.max(low, high));
  return (
    <div className="relative h-4 w-24" aria-label={`Confidence interval ${signedPercent(low)} to ${signedPercent(high)}`}>
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-[#e6e8ec]" />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#3cb043]" style={{ left, width: `max(8px, calc(${right} - ${left}))` }} />
      <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#3cb043] bg-white" style={{ left: place(lift) }} />
    </div>
  );
}

function VisitorChart({
  experimentId,
  startedAt,
  names,
}: {
  experimentId: string;
  startedAt: string | null;
  names: { control: string; treatment: string };
}) {
  const [points, setPoints] = useState<DailyVisitors[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/autopilot/experiments/${experimentId}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => (await res.json().catch(() => ({}))) as { series?: DailyVisitors[] })
      .then((body) => setPoints(fillDays(startedAt, body.series ?? [])))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPoints(fillDays(startedAt, []));
      });
    return () => controller.abort();
  }, [experimentId, startedAt]);

  return (
    <section className="border-t border-[#e6e8ec] px-4 py-3">
      <button type="button" className="mb-3 text-xs text-[#2563eb]" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide graph" : "Show graph"}
      </button>
      {open && (
        <>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1 font-medium">
              Visitors over time
            </span>
            <span className="flex items-center gap-4 text-xs text-[#6b7280]">
              <Legend color="#5c6570" label={names.control} />
              <Legend color="#db2777" label={names.treatment} />
            </span>
          </div>
          {points == null ? (
            <p className="py-8 text-sm text-[#6b7280]">Loading visitors…</p>
          ) : (
            <VisitorLines points={points} />
          )}
        </>
      )}
    </section>
  );
}

function VisitorLines({ points }: { points: DailyVisitors[] }) {
  const width = 720;
  const height = 260;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = Math.max(1, ...points.flatMap((point) => [point.control, point.treatment]));
  const yMax = niceCeiling(max);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (index: number) => pad.l + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yAt = (value: number) => pad.t + (1 - value / yMax) * innerH;
  const path = (key: "control" | "treatment") =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(point[key]).toFixed(1)}`).join(" ");
  const ticks = [0, yMax / 2, yMax];
  const labelAt = (index: number) => points[index]?.day.slice(5).replace("-", "/");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Visitors over time">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} stroke="#e6e8ec" />
          <text x={pad.l - 8} y={yAt(tick) + 3} textAnchor="end" fill="#9aa0a8" fontSize="11">
            {tickLabel(tick)}
          </text>
        </g>
      ))}
      {points.length > 0 && (
        <>
          <path d={path("control")} fill="none" stroke="#5c6570" strokeWidth="1.5" />
          <path d={path("treatment")} fill="none" stroke="#db2777" strokeWidth="1.5" />
          <text x={xAt(0)} y={height - 8} fill="#9aa0a8" fontSize="11">
            {labelAt(0)}
          </text>
          {points.length > 2 && (
            <text x={xAt(Math.floor(points.length / 2))} y={height - 8} textAnchor="middle" fill="#9aa0a8" fontSize="11">
              {labelAt(Math.floor(points.length / 2))}
            </text>
          )}
          <text x={xAt(points.length - 1)} y={height - 8} textAnchor="end" fill="#9aa0a8" fontSize="11">
            {labelAt(points.length - 1)}
          </text>
        </>
      )}
    </svg>
  );
}

/** A fact about how results are counted. Not a menu: each has one value today, so it reads as plain text. */
function ToolbarLabel({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1" title={`${label}: ${value}`}>
      <span>{label}</span>
      <span className="max-w-56 truncate text-[#1c1c1c]">{value}</span>
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#9aa0a8]">{label}</dt>
      <dd className="mt-0.5 text-[#1c1c1c]">{value}</dd>
    </div>
  );
}

function armNames(experiment: Experiment | null, signal: Signal | null): { control: string; treatment: string } {
  const base = slug(experiment?.title || signal?.title || "experiment");
  return {
    control: slug(experiment?.control || "") || `${base}_current`,
    treatment: slug(experiment?.treatment || "") || `${base}_new`,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

function statusLabel(status: Experiment["status"]): string {
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  if (status === "building") return "Writing";
  if (status === "awaiting_approval") return "Suggested";
  if (status === "awaiting_rollout") return "Won";
  if (status === "rolled_out") return "Rolled out";
  if (status === "stopped") return "Stopped";
  if (status === "rejected") return "Rejected";
  return "Failed";
}

function formatDay(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysRunning(experiment: Experiment | null): string {
  const start = experiment?.startedAt;
  if (!start) return "—";
  const days = Math.max(1, Math.round((Date.now() - Date.parse(start)) / 86_400_000));
  return String(days);
}

function rangeLabel(start: string | null): string {
  if (!start) return "Not started";
  return `${formatDay(start)} – ${formatDay(new Date().toISOString())}`;
}

function signedPercent(value: number): string {
  const percent = value * 100;
  const text = `${Math.abs(percent).toFixed(2)}%`;
  if (percent > 0) return `+${text}`;
  if (percent < 0) return `-${text}`;
  return text;
}

function significanceLabel(pValue: number | null): string {
  if (pValue == null) return "—";
  return `${Math.max(0, Math.min(99, Math.round((1 - pValue) * 100)))}%`;
}

function rateInterval(control: ArmResult, treatment: ArmResult): { lift: number; low: number; high: number } | null {
  if (control.visitors === 0 || treatment.visitors === 0) return null;
  const base = control.conversions / control.visitors;
  const next = treatment.conversions / treatment.visitors;
  if (base === 0) return null;
  const se = Math.sqrt((base * (1 - base)) / control.visitors + (next * (1 - next)) / treatment.visitors);
  const diff = next - base;
  return { lift: diff / base, low: (diff - 1.96 * se) / base, high: (diff + 1.96 * se) / base };
}

function fillDays(startedAt: string | null, series: DailyVisitors[]): DailyVisitors[] {
  if (!startedAt) return series;
  const start = new Date(startedAt);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const known = new Map(series.map((point) => [point.day, point]));
  const points: DailyVisitors[] = [];
  for (let time = start.getTime(); time <= end.getTime() && points.length < 62; time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    points.push(known.get(day) ?? { day, control: 0, treatment: 0 });
  }
  return points.length ? points : series;
}

function tickLabel(value: number): string {
  if (value >= 100 || Number.isInteger(value)) return Math.round(value).toLocaleString("en-US");
  return value.toFixed(1);
}

function niceCeiling(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * power;
}
