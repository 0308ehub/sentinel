"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Ticket, Loader2, Pencil, X, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PRDActionsProps {
  prd: { id: string; content: string; title: string };
  // Ticket generation — controlled by parent (state lives in workspace context)
  generatingTickets?: boolean;
  hasTickets?: boolean;
  onGenerateTickets?: () => void;
  onClearTickets?: () => void;
  clearingTickets?: boolean;
  // Edit lifecycle — controlled by parent
  editing?: boolean;
  saving?: boolean;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSave?: () => void;
}

export function PRDActions({
  prd,
  generatingTickets,
  hasTickets,
  onGenerateTickets,
  onClearTickets,
  clearingTickets,
  editing,
  saving,
  onEdit,
  onCancelEdit,
  onSave,
}: PRDActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prd.content);
    setCopied(true);
    toast.success("Markdown copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
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
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
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
          {hasTickets && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClearTickets}
              disabled={clearingTickets || generatingTickets}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              {clearingTickets ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {clearingTickets ? "Clearing…" : "Clear Tickets"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={onGenerateTickets}
            disabled={generatingTickets}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
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
