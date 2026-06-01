"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExternalLink, Zap, ChevronDown, ChevronRight, MoreHorizontal, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

type TicketStatus = "BACKLOG" | "IN_SPRINT" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  ticketType: string | null;
  estimate: string | null;
  externalLinearId: string | null;
  externalLinearUrl: string | null;
  acceptanceCriteria: string[];
  opportunity: { title: string } | null;
  prd: { title: string } | null;
}

interface TicketsBoardProps {
  workspaceId: string;
  initialTickets: Ticket[];
  hasLinearConnector: boolean;
}

const COLUMNS: { key: TicketStatus; label: string; color: string; bg: string }[] = [
  { key: "BACKLOG",     label: "Backlog",      color: "text-gray-500",    bg: "bg-gray-50 border-gray-200" },
  { key: "IN_SPRINT",  label: "Sprint",        color: "text-blue-600",    bg: "bg-blue-50 border-blue-200" },
  { key: "IN_PROGRESS",label: "In Progress",   color: "text-violet-600",  bg: "bg-violet-50 border-violet-200" },
  { key: "IN_REVIEW",  label: "In Review",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  { key: "DONE",       label: "Done",          color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
];

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH:     "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM:   "bg-amber-100 text-amber-700 border-amber-200",
  LOW:      "bg-gray-100 text-gray-600 border-gray-200",
};

const TYPE_LABELS: Record<string, string> = {
  frontend: "FE", backend: "BE", fullstack: "FS",
  data: "DA", design: "DS", analytics: "AN", qa: "QA",
};

function PriorityDot({ priority }: { priority: TicketPriority }) {
  const colors: Record<TicketPriority, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-400",
    MEDIUM: "bg-amber-400",
    LOW: "bg-gray-300",
  };
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", colors[priority])} />;
}

function TicketCard({
  ticket,
  workspaceId,
  hasLinearConnector,
  onStatusChange,
  onExportToLinear,
}: {
  ticket: Ticket;
  workspaceId: string;
  hasLinearConnector: boolean;
  onStatusChange: (id: string, status: TicketStatus) => void;
  onExportToLinear: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const statusOptions = COLUMNS.filter((c) => c.key !== ticket.status);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="flex items-start gap-2">
        <PriorityDot priority={ticket.priority} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{ticket.title}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {ticket.ticketType && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wide">
                {TYPE_LABELS[ticket.ticketType] ?? ticket.ticketType}
              </span>
            )}
            {ticket.estimate && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-400">
                {ticket.estimate}
              </span>
            )}
            {ticket.externalLinearUrl && (
              <a
                href={ticket.externalLinearUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] flex items-center gap-0.5 text-violet-500 hover:text-violet-700"
              >
                <ExternalLink className="h-2.5 w-2.5" /> Linear
              </a>
            )}
          </div>
        </div>

        {/* Context menu */}
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-40"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Move to</div>
              {statusOptions.map((col) => (
                <button
                  key={col.key}
                  onClick={() => { onStatusChange(ticket.id, col.key); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  {col.label}
                </button>
              ))}
              {hasLinearConnector && !ticket.externalLinearId && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { onExportToLinear(ticket.id); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 flex items-center gap-1.5"
                  >
                    <Zap className="h-3 w-3" /> Export to Linear
                  </button>
                </>
              )}
              {ticket.opportunity && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <Link
                    href={`/workspaces/${workspaceId}/opportunities`}
                    className="block px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    View opportunity
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Source */}
      {(ticket.opportunity || ticket.prd) && (
        <p className="text-[10px] text-gray-400 mt-1.5 truncate">
          {ticket.prd?.title ?? ticket.opportunity?.title}
        </p>
      )}

      {/* Expand/collapse for AC */}
      {ticket.acceptanceCriteria.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 mt-2"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {ticket.acceptanceCriteria.length} acceptance criteria
        </button>
      )}
      {expanded && (
        <ul className="mt-1.5 space-y-0.5 pl-3">
          {ticket.acceptanceCriteria.map((ac, i) => (
            <li key={i} className="text-[10px] text-gray-500 list-disc">{ac}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TicketsBoard({ workspaceId, initialTickets, hasLinearConnector }: TicketsBoardProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);

  const handleStatusChange = useCallback(async (ticketId: string, newStatus: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/tickets/${ticketId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) }
      );
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to update ticket status");
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: initialTickets.find((i) => i.id === ticketId)?.status ?? t.status } : t))
      );
    }
  }, [workspaceId, initialTickets]);

  const handleBatchMoveToSprint = useCallback(async (ticketIds: string[]) => {
    if (ticketIds.length === 0) return;
    setTickets((prev) =>
      prev.map((t) => ticketIds.includes(t.id) ? { ...t, status: "IN_SPRINT" } : t)
    );
    try {
      await Promise.all(
        ticketIds.map((id) =>
          fetch(`/api/workspaces/${workspaceId}/tickets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "IN_SPRINT" }),
          })
        )
      );
      toast.success(`${ticketIds.length} tickets moved to sprint`);
    } catch {
      toast.error("Some tickets failed to move");
      router.refresh();
    }
  }, [workspaceId, router]);

  const handleExportToLinear = useCallback(async (ticketId: string) => {
    toast.loading("Exporting to Linear…", { id: ticketId });
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/tickets/${ticketId}/export-to-linear`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      const updated = json.data;
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...updated } : t)));
      toast.success("Exported to Linear", { id: ticketId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed", { id: ticketId });
    }
  }, [workspaceId]);

  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "ALL">("ALL");

  const filteredTickets = useMemo(
    () => priorityFilter === "ALL" ? tickets : tickets.filter((t) => t.priority === priorityFilter),
    [tickets, priorityFilter]
  );
  const byStatus = (status: TicketStatus) => filteredTickets.filter((t) => t.status === status);
  const totalCount = tickets.length;
  const doneCount = tickets.filter((t) => t.status === "DONE").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {totalCount} ticket{totalCount !== 1 ? "s" : ""} · {doneCount} done
              {totalCount > 0 && (
                <> · <span className="text-violet-600 font-medium">{Math.round((doneCount / totalCount) * 100)}% complete</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Priority filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-gray-400" />
              {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                    priorityFilter === p
                      ? p === "CRITICAL" ? "bg-red-100 text-red-700 border-red-200"
                        : p === "HIGH" ? "bg-orange-100 text-orange-700 border-orange-200"
                        : p === "MEDIUM" ? "bg-amber-100 text-amber-700 border-amber-200"
                        : p === "LOW" ? "bg-gray-100 text-gray-600 border-gray-200"
                        : "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {p === "ALL" ? "All" : p[0] + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            {hasLinearConnector && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Zap className="h-3 w-3 text-violet-400" /> Linear connected
              </span>
            )}
            <Link href={`/workspaces/${workspaceId}/prd`}>
              <Button variant="outline" size="sm" className="text-xs">Generate from PRD</Button>
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / totalCount) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Empty state */}
      {totalCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-violet-300" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No tickets yet</h3>
            <p className="text-sm text-gray-400 mb-6">
              Generate engineering tickets from a PRD or opportunity to start planning your sprint.
            </p>
            <Link href={`/workspaces/${workspaceId}/prd`}>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">Go to PRDs</Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Kanban columns */
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 h-full p-6 min-w-max">
            {COLUMNS.map((col) => {
              const colTickets = byStatus(col.key);
              return (
                <div key={col.key} className="flex flex-col w-72 shrink-0">
                  {/* Column header */}
                  <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg border-t border-x text-xs font-semibold", col.bg, col.color)}>
                    <span>{col.label}</span>
                    <div className="flex items-center gap-1.5">
                      {col.key === "BACKLOG" && colTickets.length > 0 && (
                        <button
                          onClick={() => handleBatchMoveToSprint(colTickets.map((t) => t.id))}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 font-semibold transition-colors"
                        >
                          → Sprint
                        </button>
                      )}
                      <span className="px-1.5 py-0.5 rounded-full bg-white/70 text-xs font-bold">
                        {colTickets.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className={cn("flex-1 overflow-y-auto rounded-b-lg border border-t-0 p-2 space-y-2", col.bg)}>
                    {colTickets.length === 0 ? (
                      <div className="h-16 flex items-center justify-center text-[11px] text-gray-300 italic">
                        No tickets
                      </div>
                    ) : (
                      colTickets.map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          workspaceId={workspaceId}
                          hasLinearConnector={hasLinearConnector}
                          onStatusChange={handleStatusChange}
                          onExportToLinear={handleExportToLinear}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
