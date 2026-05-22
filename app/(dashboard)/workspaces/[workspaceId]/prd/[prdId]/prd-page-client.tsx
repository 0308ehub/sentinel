"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Ticket, Loader2, Pencil } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { PRDActions } from "./prd-actions";
import type { StreamingTicket } from "@/server/services/ticket-service";

interface CommittedTicket {
  id: string;
  title: string;
  priority: string;
  ticketType: string | null;
  estimate: string | null;
}

const priorityColors: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-gray-100 text-gray-600",
};

function TicketCard({
  ticket,
  streaming,
}: {
  ticket: CommittedTicket | StreamingTicket;
  streaming?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200",
        streaming && "border-violet-200 ring-1 ring-violet-100"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-gray-800 leading-snug">
          {ticket.title}
        </p>
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded font-medium shrink-0",
            priorityColors[ticket.priority] ?? "bg-gray-100 text-gray-600"
          )}
        >
          {ticket.priority}
        </span>
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
  const [streamingTickets, setStreamingTickets] = useState<StreamingTicket[]>(
    []
  );
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(prd.content);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const showStreaming = generating || streamingTickets.length > 0;
  const tickets = showStreaming ? streamingTickets : prd.tickets;

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

  return (
    <>
      {/* Header: title + meta on left, action buttons on right */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{prd.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {prd.opportunity && (
              <Link
                href={`/workspaces/${workspaceId}/opportunities/${prd.opportunity.id}`}
                className="flex items-center gap-1.5 text-xs text-violet-600 font-medium hover:underline"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                {prd.opportunity.title}
                <Badge className="ml-1 text-xs bg-violet-100 text-violet-700 border-violet-200">
                  {prd.opportunity.totalScore.toFixed(0)}
                </Badge>
              </Link>
            )}
            <span className="text-xs text-gray-400">
              Created {formatDate(prd.createdAt)}
            </span>
            {prd.tickets.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Ticket className="h-3.5 w-3.5" />
                {prd.tickets.length} ticket
                {prd.tickets.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <PRDActions
          prd={{ id: prd.id, content: prd.content, title: prd.title }}
          workspaceId={workspaceId}
          onStreamingTickets={setStreamingTickets}
          onGeneratingChange={setGenerating}
          editing={editing}
          saving={saving}
          onEdit={() => setEditing(true)}
          onCancelEdit={() => {
            setEditContent(prd.content);
            setEditing(false);
          }}
          onSave={handleSave}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: PRD viewer or inline editor */}
        <div className="lg:col-span-2">
          {editing ? (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="border-b px-5 py-2.5 bg-gray-50 flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5 text-violet-500" />
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
              <Ticket className="h-3.5 w-3.5 text-violet-600" />
              Engineering Tickets
              {showStreaming && streamingTickets.length > 0 && (
                <span className="ml-auto text-xs font-normal text-violet-600 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {streamingTickets.length} so far…
                </span>
              )}
            </h2>

            {tickets.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed p-6 text-center">
                {generating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                    <p className="text-xs text-gray-400">Generating tickets…</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No tickets generated yet.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    streaming={showStreaming}
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
