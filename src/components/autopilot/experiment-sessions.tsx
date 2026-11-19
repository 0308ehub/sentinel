"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Clock, ListFilter, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workSession, type WorkBucket, type WorkSession, type WorkTone } from "@/lib/autopilot/work-sessions";
import type { Experiment } from "@/lib/autopilot/types";
import { cn } from "@/lib/utils";

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
  const [filter, setFilter] = useState<SessionFilter>("active");
  const rows = useMemo(() => {
    return experiments
      .map((experiment) => ({ experiment, session: workSession(experiment) }))
      .filter(({ session }) => session.id === selectedId || matches(filter, session))
      .sort((a, b) => ORDER.indexOf(a.session.bucket) - ORDER.indexOf(b.session.bucket) || b.session.updated - a.session.updated);
  }, [experiments, filter, selectedId]);

  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const needsReview = rows.filter(({ session }) => session.bucket === "review" || session.bucket === "ready").length;

  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-[#e7e7e7] bg-white pt-3">
        <IconButton label="Show sessions" onClick={() => writeCollapsed(false)}>
          <PanelLeftOpen className="h-4 w-4" />
        </IconButton>
        {needsReview > 0 && (
          <span className="rounded-full bg-[#fdf1e4] px-1.5 text-[11px] font-medium text-[#e08a32]" title={`${needsReview} need review`}>
            {needsReview}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-[#e7e7e7] bg-white">
      <div className="flex items-center gap-1 px-3 pb-1 pt-3">
        <h2 className="mr-auto text-[15px] font-medium tracking-tight text-[#2c2c2c]">Sessions</h2>
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
          <PanelLeftClose className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-[13px] leading-5 text-[#8b919a]">
            {filter === "active"
              ? "Sessions show up here while Kismet is writing an experiment, and when a pull request is ready for you."
              : "Nothing in this filter."}
          </p>
        ) : (
          <ul>
            {rows.map(({ experiment, session }) => (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  selected={session.id === selectedId}
                  onOpen={() => onOpen(session.id)}
                  onStop={() => {
                    if (window.confirm(`Stop “${experiment.title}” and remove the unmerged change?`)) onStop(experiment);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function matches(filter: SessionFilter, session: WorkSession): boolean {
  if (filter === "review") return session.bucket === "review" || session.bucket === "ready";
  if (filter === "working") return session.bucket === "working";
  if (filter === "running") return session.bucket === "running";
  if (filter === "ended") return session.bucket === "quiet";
  return session.bucket !== "quiet";
}

function SessionRow({
  session,
  selected,
  onOpen,
  onStop,
}: {
  session: WorkSession;
  selected: boolean;
  onOpen: () => void;
  onStop: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2.5 rounded-md px-2 py-1.5",
        selected ? "bg-[#f2f2f4]" : "hover:bg-[#f7f7f8]",
      )}
    >
      <button type="button" onClick={onOpen} title={session.hint} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
        <StatusMark mark={session.mark} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] leading-5 text-[#1c1c1c]">{session.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-4 text-[#8b919a]">
            {session.line ? <span className={TONE[session.line.tone]}>{session.line.text}</span> : <span>{session.age}</span>}
            {session.pulls > 0 && <Count color="#1f8a4c" count={session.pulls} label={`${session.pulls} pull ${session.pulls === 1 ? "request" : "requests"}`} />}
            {session.followUps > 0 && <Count color="#7c5cbf" count={session.followUps} label={`${session.followUps} follow-up pull ${session.followUps === 1 ? "request" : "requests"}`} />}
            {session.clock && <Clock className="h-3 w-3 text-[#9aa0a8]" aria-hidden />}
          </span>
        </span>
      </button>
      {session.canStop && (
        <button
          type="button"
          aria-label={`Stop ${session.title}`}
          onClick={onStop}
          className={cn(
            "mt-1 shrink-0 rounded p-0.5 text-[#8b919a] hover:bg-white hover:text-[#1c1c1c]",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusMark({ mark }: { mark: WorkSession["mark"] }) {
  if (mark === "blue") return <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#3b82f6]" />;
  if (mark === "dashed") return <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-[#c5c8ce]" />;
  return <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c5c8ce]" />;
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
