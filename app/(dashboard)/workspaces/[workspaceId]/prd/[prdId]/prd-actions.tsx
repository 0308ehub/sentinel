"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Ticket, Loader2, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";

interface PRDActionsProps {
  prd: { id: string; content: string; title: string };
  workspaceId: string;
}

export function PRDActions({ prd, workspaceId }: PRDActionsProps) {
  const [copied, setCopied] = useState(false);
  const [generatingTickets, setGeneratingTickets] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(prd.content);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleCopy() {
    await navigator.clipboard.writeText(prd.content);
    setCopied(true);
    toast.success("Markdown copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateTickets() {
    setGeneratingTickets(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tickets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prdId: prd.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to generate tickets");
      const count = Array.isArray(data.data) ? data.data.length : 0;
      toast.success(`Generated ${count} engineering ticket${count !== 1 ? "s" : ""}!`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate tickets");
    } finally {
      setGeneratingTickets(false);
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

  return (
    <>
      {/* Action buttons row — always rendered */}
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
              onClick={() => {
                setEditContent(prd.content);
                setEditing(false);
              }}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
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
              onClick={() => setEditing(true)}
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

      {/* Inline edit panel — appears below header when editing */}
      {editing && (
        <div className="col-span-full mt-4 bg-white rounded-xl border overflow-hidden">
          <div className="border-b px-5 py-3 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-200" />
                <div className="w-3 h-3 rounded-full bg-gray-200" />
                <div className="w-3 h-3 rounded-full bg-gray-200" />
              </div>
              <span className="text-xs text-gray-400 font-mono ml-2">
                {prd.title}.md <span className="text-violet-500 font-semibold">— editing</span>
              </span>
            </div>
          </div>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[60vh] font-mono text-sm rounded-none border-0 focus-visible:ring-0 resize-none p-6"
          />
        </div>
      )}
    </>
  );
}
