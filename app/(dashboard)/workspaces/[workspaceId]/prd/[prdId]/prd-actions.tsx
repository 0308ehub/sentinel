"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy, Check, Ticket, Loader2, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";
import type { StreamingTicket } from "@/server/services/ticket-service";

interface PRDActionsProps {
  prd: { id: string; content: string; title: string };
  workspaceId: string;
  onStreamingTickets?: (tickets: StreamingTicket[]) => void;
  onGeneratingChange?: (generating: boolean) => void;
  // Edit lifecycle — controlled by parent
  editing?: boolean;
  saving?: boolean;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSave?: () => void;
}

export function PRDActions({
  prd,
  workspaceId,
  onStreamingTickets,
  onGeneratingChange,
  editing,
  saving,
  onEdit,
  onCancelEdit,
  onSave,
}: PRDActionsProps) {
  const [copied, setCopied] = useState(false);
  const [generatingTickets, setGeneratingTickets] = useState(false);
  const router = useRouter();

  async function handleCopy() {
    await navigator.clipboard.writeText(prd.content);
    setCopied(true);
    toast.success("Markdown copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateTickets() {
    setGeneratingTickets(true);
    onGeneratingChange?.(true);
    onStreamingTickets?.([]);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/tickets/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prdId: prd.id }),
        }
      );

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: StreamingTicket[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (event.type === "ticket" && event.data) {
              collected.push(event.data as StreamingTicket);
              onStreamingTickets?.([...collected]);
            } else if (event.type === "done") {
              toast.success(
                `Generated ${collected.length} engineering ticket${collected.length !== 1 ? "s" : ""}!`
              );
              router.refresh();
            } else if (event.type === "error") {
              throw new Error(
                typeof event.message === "string"
                  ? event.message
                  : "Failed to generate tickets"
              );
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate tickets"
      );
      onStreamingTickets?.([]);
    } finally {
      setGeneratingTickets(false);
      onGeneratingChange?.(false);
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="gap-1.5"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy Markdown
          </>
        )}
      </Button>

      {editing ? (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancelEdit}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateTickets}
            disabled={generatingTickets}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {generatingTickets ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ticket className="h-3.5 w-3.5" />
            )}
            {generatingTickets ? "Generating…" : "Generate Tickets"}
          </Button>
        </>
      )}
    </div>
  );
}
