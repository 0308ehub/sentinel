"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Ticket, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { PRDActions } from "./prd-actions";
import { useJob, type StreamingTicket } from "../../workspace-jobs-context";
import { useWorkspace } from "../../workspace-context";
import { computeHunks, applyHunks } from "@/lib/diff/prd-diff";
import type { DiffState } from "@/lib/diff/prd-diff";
import { PRDDiffViewer } from "@/components/prd/prd-diff-viewer";

interface CommittedTicket {
  id: string;
  title: string;
  priority: string;
  ticketType: string | null;
  estimate: string | null;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const priorityColors: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-gray-100 text-gray-600",
};

function TicketCard({
  ticket,
  workspaceId,
  streaming,
  onUpdate,
  onDelete,
}: {
  ticket: CommittedTicket | StreamingTicket;
  workspaceId: string;
  streaming?: boolean;
  onUpdate?: (id: string, updates: { title?: string; priority?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editPriority, setEditPriority] = useState(ticket.priority);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(ticket.id, { title: editTitle, priority: editPriority });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditTitle(ticket.title);
    setEditPriority(ticket.priority);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(ticket.id);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const canEdit = !streaming && !!onUpdate && !!onDelete;

  if (editing) {
    return (
      <div className="bg-white rounded-lg border border-indigo-200 ring-1 ring-indigo-100 px-3 py-2.5 animate-in fade-in duration-100">
        <textarea
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
            if (e.key === "Escape") handleCancelEdit();
          }}
          className="w-full text-xs font-medium text-gray-800 leading-snug resize-none outline-none mb-2 min-h-[2.5rem]"
          rows={2}
        />
        <div className="flex items-center justify-between gap-2">
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-700 outline-none cursor-pointer"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCancelEdit}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editTitle.trim()}
              className="p-1 rounded hover:bg-green-50 text-green-600 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group bg-white rounded-lg border px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200",
        streaming && "border-indigo-200 ring-1 ring-indigo-100"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-gray-800 leading-snug flex-1">
          {ticket.title}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded font-medium",
              priorityColors[ticket.priority] ?? "bg-gray-100 text-gray-600"
            )}
          >
            {ticket.priority}
          </span>
          {canEdit && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                onBlur={() => setConfirmingDelete(false)}
                className={cn(
                  "opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all",
                  confirmingDelete
                    ? "opacity-100 text-red-600 hover:bg-red-50"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                )}
              >
                {deleting
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />}
              </button>
            </>
          )}
        </div>
      </div>
      {(ticket.ticketType || ticket.estimate) && (
        <div className="flex gap-2">
          {ticket.ticketType && (
            <span className="text-xs text-gray-400">{ticket.ticketType}</span>
          )}
          {ticket.estimate && (
            <span className="text-xs text-gray-400">· {ticket.estimate}</span>
          )}
        </div>
      )}
      {confirmingDelete && (
        <p className="text-xs text-red-500 mt-1.5">Click trash again to confirm delete</p>
      )}
    </div>
  );
}

interface PRDPageClientProps {
  prd: {
    id: string;
    content: string;
    title: string;
    createdAt: string;
    opportunity: { id: string; title: string; totalScore: number } | null;
    tickets: CommittedTicket[];
  };
  workspaceId: string;
}

export function PRDPageClient({ prd, workspaceId }: PRDPageClientProps) {
  const jobKey = `tickets:${prd.id}`;
  const {
    running: generatingTickets,
    streamingTickets,
    startJob,
  } = useJob(jobKey);

  const {
    openPRDTab,
    setPRDWorkingContent,
    getPRDWorkingContent,
    prdProposals,
    clearPRDProposal,
  } = useWorkspace();

  // Working content tracks the PRD as hunks are accepted/rejected
  const [workingContent, setWorkingContent] = useState(prd.content);
  // Active diff state (null when no diff pending)
  const [diffState, setDiffState] = useState<DiffState | null>(null);

  // Local ticket list for optimistic updates
  const [localTickets, setLocalTickets] = useState<CommittedTicket[]>(prd.tickets);
  useEffect(() => { setLocalTickets(prd.tickets); }, [prd.tickets]);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(prd.content);
  const [saving, setSaving] = useState(false);
  const [savingDiff, setSavingDiff] = useState(false);
  const [clearingTickets, setClearingTickets] = useState(false);
  const router = useRouter();

  // Register PRD tab in agent panel and seed working content on mount
  useEffect(() => {
    openPRDTab(prd.id, prd.title);
    setPRDWorkingContent(prd.id, prd.content);
    return () => clearPRDProposal(prd.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prd.id, prd.title]);

  // Keep working content in sync with context so ChatBody gets the latest version
  useEffect(() => {
    setPRDWorkingContent(prd.id, workingContent);
  }, [prd.id, workingContent, setPRDWorkingContent]);

  // Watch for AI proposals arriving from the agent panel
  useEffect(() => {
    const proposed = prdProposals.get(prd.id);
    if (!proposed) return;
    const hunks = computeHunks(workingContent, proposed);
    setDiffState({ proposedContent: proposed, hunks });
    clearPRDProposal(prd.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prdProposals]);

  function acceptHunk(hunkId: string) {
    setDiffState((prev) => {
      if (!prev) return null;
      const updated = prev.hunks.map((h) =>
        h.id === hunkId ? { ...h, status: "accepted" as const } : h
      );
      const newContent = applyHunks(prd.content, updated);
      setWorkingContent(newContent);
      return { ...prev, hunks: updated };
    });
  }

  function rejectHunk(hunkId: string) {
    setDiffState((prev) => {
      if (!prev) return null;
      const updated = prev.hunks.map((h) =>
        h.id === hunkId ? { ...h, status: "rejected" as const } : h
      );
      const newContent = applyHunks(prd.content, updated);
      setWorkingContent(newContent);
      return { ...prev, hunks: updated };
    });
  }

  function acceptAll() {
    setDiffState((prev) => {
      if (!prev) return null;
      const updated = prev.hunks.map((h) => ({ ...h, status: "accepted" as const }));
      setWorkingContent(applyHunks(prd.content, updated));
      return { ...prev, hunks: updated };
    });
  }

  function rejectAll() {
    setDiffState(null);
    setWorkingContent(prd.content);
  }

  async function handleSaveDiff() {
    setSavingDiff(true);
    try {
      const res = await fetch(`/api/prds/${prd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: workingContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to save PRD");
      toast.success("PRD updated successfully");
      setDiffState(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingDiff(false);
    }
  }

  const showStreaming = generatingTickets || streamingTickets.length > 0;
  const tickets = showStreaming ? streamingTickets : localTickets;

  function handleGenerateTickets() {
    startJob(
      `/api/workspaces/${workspaceId}/tickets/generate`,
      (result: Record<string, unknown>) => {
        const count = typeof result.count === "number" ? result.count : 0;
        toast.success(
          `Generated ${count} engineering ticket${count !== 1 ? "s" : ""}!`
        );
        router.refresh();
      },
      (msg: string) => toast.error(msg),
      { body: JSON.stringify({ prdId: prd.id }) }
    );
  }

  async function handleClearTickets() {
    setClearingTickets(true);
    try {
      const res = await fetch(`/api/prds/${prd.id}/tickets`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message ?? "Failed to clear tickets");
      toast.success("Tickets cleared");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear tickets"
      );
    } finally {
      setClearingTickets(false);
    }
  }

  async function handleUpdateTicket(ticketId: string, updates: { title?: string; priority?: string }) {
    const prev = localTickets;
    setLocalTickets((curr) => curr.map((t) => t.id === ticketId ? { ...t, ...updates } : t));
    const res = await fetch(`/api/workspaces/${workspaceId}/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      setLocalTickets(prev);
      toast.error("Failed to update ticket");
    } else {
      router.refresh();
    }
  }

  async function handleDeleteTicket(ticketId: string) {
    const prev = localTickets;
    setLocalTickets((curr) => curr.filter((t) => t.id !== ticketId));
    const res = await fetch(`/api/workspaces/${workspaceId}/tickets/${ticketId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setLocalTickets(prev);
      toast.error("Failed to delete ticket");
    } else {
      toast.success("Ticket deleted");
      router.refresh();
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/prds/${prd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to save PRD");
      toast.success("PRD saved successfully");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Determine render mode
  const inDiffMode = diffState !== null && !editing;
  const currentPRDContent = getPRDWorkingContent(prd.id) ?? prd.content;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{prd.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {prd.opportunity && (
              <Link
                href={`/workspaces/${workspaceId}/opportunities/${prd.opportunity.id}`}
                className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium hover:underline"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {prd.opportunity.title}
                <Badge className="ml-1 text-xs bg-indigo-100 text-indigo-700 border-indigo-200">
                  {prd.opportunity.totalScore.toFixed(0)}
                </Badge>
              </Link>
            )}
            <span className="text-xs text-gray-400">
              Created {formatDate(prd.createdAt)}
            </span>
            {localTickets.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Ticket className="h-3.5 w-3.5" />
                {localTickets.length} ticket{localTickets.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <PRDActions
          prd={{ id: prd.id, content: currentPRDContent, title: prd.title }}
          generatingTickets={generatingTickets}
          hasTickets={tickets.length > 0}
          onGenerateTickets={handleGenerateTickets}
          onClearTickets={handleClearTickets}
          clearingTickets={clearingTickets}
          editing={editing}
          saving={saving}
          onEdit={() => {
            if (inDiffMode) {
              toast.warning("Resolve pending changes before editing.");
              return;
            }
            setEditing(true);
          }}
          onCancelEdit={() => {
            setEditContent(prd.content);
            setEditing(false);
          }}
          onSave={handleSave}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: PRD viewer, inline editor, or diff viewer */}
        <div className="lg:col-span-2">
          {editing ? (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="border-b px-5 py-2.5 bg-gray-50 flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-xs font-medium text-gray-600">
                  Editing — {prd.title}
                </span>
              </div>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60vh] text-sm rounded-none border-0 focus-visible:ring-0 resize-none p-6 leading-relaxed font-mono"
              />
            </div>
          ) : inDiffMode ? (
            <PRDDiffViewer
              originalContent={prd.content}
              diffState={diffState}
              onAcceptHunk={acceptHunk}
              onRejectHunk={rejectHunk}
              onAcceptAll={acceptAll}
              onRejectAll={rejectAll}
              onSave={handleSaveDiff}
              isSaving={savingDiff}
            />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="border-b px-5 py-3 bg-gray-50 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                </div>
                <span className="text-xs text-gray-400 font-mono ml-2">
                  {prd.title}.md
                </span>
              </div>
              <pre className="px-6 py-6 text-sm text-gray-800 font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-[calc(100vh-280px)]">
                {prd.content}
              </pre>
            </div>
          )}
        </div>

        {/* Right column: engineering tickets */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5 text-indigo-600" />
              Engineering Tickets
              {showStreaming && streamingTickets.length > 0 && (
                <span className="ml-auto text-xs font-normal text-indigo-600 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {streamingTickets.length} so far…
                </span>
              )}
            </h2>

            {tickets.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed p-6 text-center">
                {generatingTickets ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                    <p className="text-xs text-gray-400">Generating tickets…</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No tickets generated yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket: CommittedTicket | StreamingTicket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    workspaceId={workspaceId}
                    streaming={showStreaming}
                    onUpdate={showStreaming ? undefined : handleUpdateTicket}
                    onDelete={showStreaming ? undefined : handleDeleteTicket}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
