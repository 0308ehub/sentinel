"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListFilter, MoreHorizontal, PanelTopClose, PanelTopOpen, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workSession, type WorkBucket, type WorkSession, type WorkTone } from "@/lib/autopilot/work-sessions";
import type { Experiment } from "@/lib/autopilot/types";
import { cn } from "@/lib/utils";
import { prefetchExperiment } from "@/components/autopilot/experiment-queries";

type SessionFilter = "active" | "review" | "working" | "running" | "ended";

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "review", label: "Needs review" },
  { id: "working", label: "Working" },
  { id: "running", label: "Running" },
  { id: "ended", label: "Ended" },
];

const COLLAPSED_KEY = "kismet-sessions-collapsed";
const collapsedListeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage can be blocked; the panel still toggles until the next reload.
  }
  collapsedListeners.forEach((listener) => listener());
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  return () => collapsedListeners.delete(listener);
}

const ORDER: WorkBucket[] = ["review", "ready", "working", "running", "quiet"];

const TONE: Record<WorkTone, string> = {
  green: "text-[#1f8a4c]",
  orange: "text-[#e08a32]",
  muted: "text-[#6b7280]",
};

const DOT: Record<WorkTone, string> = {
  green: "bg-[#1f8a4c]",
  orange: "bg-[#e08a32]",
  muted: "bg-[#9aa0a8]",
};

export function ExperimentSessions({
  experiments,
  selectedId,
  running,
  onOpen,
  onCreate,
  onStop,
  onRun,
}: {
  experiments: Experiment[];
  selectedId: string | null;
  running: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onStop: (experiment: Experiment) => void;
  onRun: () => void;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SessionFilter>("active");
  const rows = useMemo(() => {
    return experiments
      .map((experiment) => ({ experiment, session: workSession(experiment) }))
      .filter(({ session }) => session.id === selectedId || matches(filter, session))
      .sort((a, b) => ORDER.indexOf(a.session.bucket) - ORDER.indexOf(b.session.bucket) || b.session.updated - a.session.updated);
  }, [experiments, filter, selectedId]);

  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const needsReview = rows.filter(({ session }) => session.bucket === "review" || session.bucket === "ready").length;

  useEffect(() => {
    const warm = () => { rows.slice(0, 3).forEach(({ experiment }) => { void prefetchExperiment(queryClient, experiment); }); };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idle = idleWindow.requestIdleCallback(warm);
      return () => idleWindow.cancelIdleCallback?.(idle);
    }
    const timer = window.setTimeout(warm, 0);
    return () => window.clearTimeout(timer);
  }, [queryClient, rows]);

  if (collapsed) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e7e7e7] bg-white px-3 py-1.5">
        <IconButton label="Show sessions" onClick={() => writeCollapsed(false)}>
          <PanelTopOpen className="h-4 w-4" />
        </IconButton>
        <span className="text-[13px] font-medium text-[#2c2c2c]">Sessions</span>
        {needsReview > 0 && (
          <span className="rounded-full bg-[#fdf1e4] px-1.5 text-[11px] font-medium text-[#e08a32]" title={`${needsReview} need review`}>
            {needsReview}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-[#e7e7e7] bg-white px-3">
      <h2 className="shrink-0 pr-2 text-[14px] font-medium tracking-tight text-[#2c2c2c]">Sessions</h2>
      <div role="tablist" aria-label="Sessions" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-2 [scrollbar-width:none]">
        {rows.length === 0 ? (
          <p className="truncate px-1 py-1 text-[13px] text-[#8b919a]">
            {filter === "active"
              ? "Sessions show up here while Kismet is writing an experiment, and when a pull request is ready for you."
              : "Nothing in this filter."}
          </p>
        ) : (
          rows.map(({ experiment, session }) => (
            <SessionTab
              key={session.id}
              session={session}
              selected={session.id === selectedId}
              onPrefetch={() => { void prefetchExperiment(queryClient, experiment); }}
              onOpen={() => onOpen(session.id)}
              onStop={() => {
                if (window.confirm(`Stop “${experiment.title}” and remove the unmerged change?`)) onStop(experiment);
              }}
            />
          ))
        )}
      </div>
      <IconButton label="New experiment" onClick={onCreate}>
        <Plus className="h-4 w-4" />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Filter sessions"
            className={cn(
              "rounded-md p-1.5 hover:bg-[#f3f3f4]",
              filter === "active" ? "text-[#6b7280]" : "text-[#1c1c1c]",
            )}
          >
            <ListFilter className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {FILTERS.map((item) => (
            <DropdownMenuItem key={item.id} onClick={() => setFilter(item.id)}>
              <span className={filter === item.id ? "font-medium" : ""}>{item.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Session actions" className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f3f4]">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={running} onClick={onRun}>
            Check for suggestions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Hide sessions" onClick={() => writeCollapsed(true)}>
        <PanelTopClose className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function matches(filter: SessionFilter, session: WorkSession): boolean {
  if (filter === "review") return session.bucket === "review" || session.bucket === "ready";
  if (filter === "working") return session.bucket === "working";
  if (filter === "running") return session.bucket === "running";
  if (filter === "ended") return session.bucket === "quiet";
  return session.bucket !== "quiet";
}

function SessionTab({
  session,
  selected,
  onOpen,
  onPrefetch,
  onStop,
}: {
  session: WorkSession;
  selected: boolean;
  onOpen: () => void;
  onPrefetch: () => void;
  onStop: () => void;
}) {
  return (
    <div
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        "group relative flex max-w-[280px] shrink-0 items-center rounded-full border transition-colors",
        selected ? "border-[#dcdce0] bg-[#f2f2f4]" : "border-[#ececef] hover:bg-[#f7f7f8]",
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onOpen}
        title={session.hint}
        className={cn("flex min-w-0 items-center gap-2 py-1 pl-3 text-left", session.canStop ? "pr-1" : "pr-3")}
      >
        <span className="truncate text-[13px] leading-5 text-[#1c1c1c]">{session.title}</span>
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] leading-4 text-[#8b919a]">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              DOT[session.line?.tone ?? "muted"],
              session.mark === "dashed" && "animate-pulse",
            )}
          />
          {session.line ? <span className={TONE[session.line.tone]}>{session.line.text}</span> : <span>{session.age}</span>}
          {session.pulls > 0 && <Count color="#1f8a4c" count={session.pulls} label={`${session.pulls} pull ${session.pulls === 1 ? "request" : "requests"}`} />}
          {session.followUps > 0 && <Count color="#7c5cbf" count={session.followUps} label={`${session.followUps} follow-up pull ${session.followUps === 1 ? "request" : "requests"}`} />}
        </span>
      </button>
      {session.canStop && (
        <button
          type="button"
          aria-label={`Stop ${session.title}`}
          onClick={onStop}
          className={cn(
            "mr-1.5 shrink-0 rounded-full p-0.5 text-[#8b919a] hover:bg-white hover:text-[#1c1c1c]",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {selected && <span aria-hidden className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-[#1c1c1c]" />}
    </div>
  );
}

function Count({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" style={{ color }} title={label}>
      <BranchIcon />
      <span>{count}</span>
    </span>
  );
}

function BranchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="4" cy="3.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="12.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 5.2v5.6M4 8h6.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f3f4] hover:text-[#1c1c1c]">
      {children}
    </button>
  );
}
