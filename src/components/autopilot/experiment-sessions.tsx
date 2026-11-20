"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type DragEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clock, Folder, FolderPlus, ListFilter, MoreHorizontal, Plus, Trash2 } from "lucide-react";
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
import { usePresence } from "@/components/workspace/live-sync";
import { PresenceAvatar } from "@/components/workspace/presence-avatar";
import { formatLocation, presenceHere, type PresenceEntry } from "@/lib/workspace/live-sync-core";
import {
  addFolder,
  groupedSessions,
  moveToFolder,
  parseFolders,
  removeFolder,
  renameFolder,
  toggleFolder,
  type SessionFolderState,
} from "@/lib/autopilot/session-folders";

type SessionFilter = "active" | "review" | "working" | "running" | "ended";

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "review", label: "Needs review" },
  { id: "working", label: "Working" },
  { id: "running", label: "Running" },
  { id: "ended", label: "Ended" },
];

const FOLDERS_KEY = "kismet-session-folders";
const EMPTY_FOLDERS: SessionFolderState = { folders: [], membership: {} };
const folderListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedFolders: SessionFolderState = EMPTY_FOLDERS;

function readFolders(): SessionFolderState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(FOLDERS_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedFolders;
  cachedRaw = raw;
  cachedFolders = parseFolders(raw);
  return cachedFolders;
}

function writeFolders(state: SessionFolderState) {
  const raw = JSON.stringify(state);
  cachedRaw = raw;
  cachedFolders = state;
  try {
    localStorage.setItem(FOLDERS_KEY, raw);
  } catch {
    // Storage can be blocked; the folders last until the next reload.
  }
  folderListeners.forEach((listener) => listener());
}

function subscribeFolders(listener: () => void) {
  folderListeners.add(listener);
  return () => folderListeners.delete(listener);
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
  const queryClient = useQueryClient();
  const presence = usePresence();
  const [filter, setFilter] = useState<SessionFilter>("active");
  const rows = useMemo(() => {
    return experiments
      .map((experiment) => ({ id: experiment.id, experiment, session: workSession(experiment) }))
      .filter(({ session }) => session.id === selectedId || matches(filter, session))
      .sort((a, b) => ORDER.indexOf(a.session.bucket) - ORDER.indexOf(b.session.bucket) || b.session.updated - a.session.updated);
  }, [experiments, filter, selectedId]);

  const folders = useSyncExternalStore(subscribeFolders, readFolders, () => EMPTY_FOLDERS);
  const [naming, setNaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const grouped = useMemo(() => groupedSessions(rows, folders), [folders, rows]);

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

  function createFolder() {
    const id = `folder_${crypto.randomUUID().slice(0, 8)}`;
    writeFolders(addFolder(folders, "New folder", id));
    setNaming(id);
    setDraft("New folder");
  }

  function commitName(id: string) {
    writeFolders(renameFolder(folders, id, draft));
    setNaming(null);
  }

  function onDropSession(event: DragEvent, folderId: string | null) {
    event.preventDefault();
    const experimentId = event.dataTransfer.getData("text/plain");
    setDropTarget(null);
    if (!experimentId) return;
    writeFolders(moveToFolder(readFolders(), experimentId, folderId));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div
        className={cn("flex items-center gap-1 px-3 pb-1 pt-2", dropTarget === "loose" && "bg-[#f3f3f4]")}
        onDragOver={(event) => { event.preventDefault(); setDropTarget("loose"); }}
        onDragLeave={() => setDropTarget((current) => current === "loose" ? null : current)}
        onDrop={(event) => onDropSession(event, null)}
      >
        <h2 className="mr-auto text-[13px] font-medium tracking-tight text-[#6b7280]">Sessions</h2>
        <IconButton label="New folder" onClick={createFolder}>
          <FolderPlus className="h-4 w-4" />
        </IconButton>
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
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        {rows.length === 0 && folders.folders.length === 0 ? (
          <p className="px-2 py-6 text-[13px] leading-5 text-[#8b919a]">
            {filter === "active"
              ? "Sessions show up here while Kismet is writing an experiment, and when a pull request is ready for you."
              : "Nothing in this filter."}
          </p>
        ) : (
          <div>
            {grouped.folders.map(({ folder, items }) => (
              <section
                key={folder.id}
                onDragOver={(event) => { event.preventDefault(); setDropTarget(folder.id); }}
                onDragLeave={() => setDropTarget((current) => current === folder.id ? null : current)}
                onDrop={(event) => onDropSession(event, folder.id)}
                className={cn("rounded-md", dropTarget === folder.id && "bg-[#f3f3f4]")}
              >
                <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-[13px] text-[#374151] hover:bg-[#f7f7f8]">
                  <button type="button" aria-label={folder.open ? `Collapse ${folder.name}` : `Expand ${folder.name}`} onClick={() => writeFolders(toggleFolder(folders, folder.id))} className="rounded p-0.5 text-[#6b7280]">
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", folder.open && "rotate-90")} />
                  </button>
                  <Folder className="h-3.5 w-3.5 shrink-0 text-[#8b919a]" />
                  {naming === folder.id ? (
                    <input
                      autoFocus
                      value={draft}
                      aria-label="Folder name"
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => commitName(folder.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitName(folder.id);
                        if (event.key === "Escape") setNaming(null);
                      }}
                      className="h-6 min-w-0 flex-1 rounded border border-[#d5d8de] bg-white px-1.5 text-[13px] outline-none"
                    />
                  ) : (
                    <button type="button" onDoubleClick={() => { setNaming(folder.id); setDraft(folder.name); }} className="min-w-0 flex-1 truncate text-left">
                      {folder.name}
                    </button>
                  )}
                  <button type="button" aria-label={`Delete ${folder.name}`} onClick={() => writeFolders(removeFolder(folders, folder.id))} className="rounded p-0.5 text-[#8b919a] opacity-0 hover:text-[#1c1c1c] group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {folder.open && (
                  <ul className="pl-4">
                    {items.map((row) => (
                      <li key={row.session.id}>
                        <SessionEntry
                          row={row}
                          folders={folders}
                          selectedId={selectedId}
                          presence={presence}
                          onOpen={onOpen}
                          onStop={onStop}
                          onPrefetch={() => { void prefetchExperiment(queryClient, row.experiment); }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <ul>
              {grouped.loose.map((row) => (
                <li key={row.session.id}>
                  <SessionEntry
                    row={row}
                    folders={folders}
                    selectedId={selectedId}
                    presence={presence}
                    onOpen={onOpen}
                    onStop={onStop}
                    onPrefetch={() => { void prefetchExperiment(queryClient, row.experiment); }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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

function SessionEntry({
  row,
  folders,
  selectedId,
  presence,
  onOpen,
  onStop,
  onPrefetch,
}: {
  row: { experiment: Experiment; session: WorkSession };
  folders: SessionFolderState;
  selectedId: string | null;
  presence: PresenceEntry[];
  onOpen: (id: string) => void;
  onStop: (experiment: Experiment) => void;
  onPrefetch: () => void;
}) {
  const { experiment, session } = row;
  return (
    <SessionRow
      session={session}
      folders={folders.folders}
      folderId={folders.membership[session.id] ?? null}
      viewers={presenceHere(presence, formatLocation("/experiments", session.id)).slice(0, 3)}
      selected={session.id === selectedId}
      onPrefetch={onPrefetch}
      onOpen={() => onOpen(session.id)}
      onMove={(folderId) => writeFolders(moveToFolder(readFolders(), session.id, folderId))}
      onStop={() => {
        if (window.confirm(`Stop “${experiment.title}” and remove the unmerged change?`)) onStop(experiment);
      }}
    />
  );
}

function SessionRow({
  session,
  selected,
  onOpen,
  onPrefetch,
  onStop,
  onMove,
  viewers,
  folders,
  folderId,
}: {
  session: WorkSession;
  selected: boolean;
  onOpen: () => void;
  onPrefetch: () => void;
  onStop: () => void;
  onMove: (folderId: string | null) => void;
  viewers: PresenceEntry[];
  folders: SessionFolderState["folders"];
  folderId: string | null;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", session.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
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
      {viewers.length > 0 && (
        <span className="mt-1 flex shrink-0 -space-x-1" aria-label={`${viewers.length} viewing`}>
          {viewers.map((person) => <PresenceAvatar key={person.userId} person={person} />)}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Move ${session.title}`} className={cn("mt-1 shrink-0 rounded p-0.5 text-[#8b919a] hover:bg-white hover:text-[#1c1c1c]", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <Folder className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {folders.length === 0 && <DropdownMenuItem disabled>Create a folder first</DropdownMenuItem>}
          {folders.map((folder) => (
            <DropdownMenuItem key={folder.id} disabled={folder.id === folderId} onClick={() => onMove(folder.id)}>
              {folder.name}
            </DropdownMenuItem>
          ))}
          {folderId && <DropdownMenuItem onClick={() => onMove(null)}>Remove from folder</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
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
