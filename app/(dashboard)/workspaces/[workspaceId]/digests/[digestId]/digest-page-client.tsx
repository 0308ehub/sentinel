"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Check, X, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../../workspace-context";

interface SerializedDigest {
  id: string;
  type: string;
  content: string;
  title: string;
  createdAt: string;
}

interface DigestPageClientProps {
  digest: SerializedDigest;
  workspaceId: string;
}

export function DigestPageClient({ digest, workspaceId }: DigestPageClientProps) {
  const {
    openDigestTab,
    digestProposals,
    clearDigestProposal,
  } = useWorkspace();

  const [content, setContent] = useState(digest.content);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(digest.content);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Register digest tab in agent panel on mount
  useEffect(() => {
    openDigestTab(digest.id, digest.title);
    return () => clearDigestProposal(digest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digest.id, digest.title]);

  // Watch for AI proposals from the agent panel
  const proposedContent = digestProposals.get(digest.id);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/digests/${digest.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to save");
      setContent(editContent);
      setEditing(false);
      toast.success("Digest saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptProposal() {
    if (!proposedContent) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/digests/${digest.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: proposedContent }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to save");
      setContent(proposedContent);
      clearDigestProposal(digest.id);
      toast.success("Digest updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleRejectProposal() {
    clearDigestProposal(digest.id);
  }

  const typeBadgeClass =
    digest.type === "DAILY"
      ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
      : digest.type === "WEEKLY"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-indigo-500 shrink-0" />
            {digest.title}
          </h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeBadgeClass}`}>
              {digest.type}
            </span>
            <span className="text-xs text-gray-400">
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(digest.createdAt))}
            </span>
          </div>
        </div>

        {!editing && !proposedContent && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditContent(content);
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}

        {editing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              className="gap-2"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* AI Proposal Banner */}
      {proposedContent && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            Sentinel proposed a rewrite
          </p>
          <p className="text-xs text-amber-700 mb-3">
            Accept to replace the current digest content, or reject to discard the proposal.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAcceptProposal}
              disabled={saving}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRejectProposal}
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="border-b px-5 py-2.5 bg-gray-50 flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-medium text-gray-600">Editing — {digest.title}</span>
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
            <span className="text-xs text-gray-400 font-mono ml-2">{digest.title}</span>
          </div>
          <pre className="px-6 py-6 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-[calc(100vh-280px)]">
            {proposedContent ?? content}
          </pre>
        </div>
      )}
    </>
  );
}
