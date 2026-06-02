"use client";

import { useState, useEffect } from "react";
import { X, CheckSquare, Square, Loader2, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Candidate {
  externalId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  relevanceScore: number;
  relevanceReason: string;
  alreadyImported: boolean;
}

interface ReviewDrawerProps {
  connectorId: string;
  workspaceId: string;
  connectorName: string;
  open: boolean;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 60 ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/20"
    : pct >= 30 ? "text-amber-400 bg-amber-500/15 border-amber-500/20"
    : "text-muted-foreground bg-muted border-border";
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", color)}>
      {pct}% relevant
    </span>
  );
}

export function ReviewDrawer({ connectorId, workspaceId, connectorName, open, onClose }: ReviewDrawerProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0.3);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSelected(new Set());

    fetch(`/api/workspaces/${workspaceId}/connectors/${connectorId}/scan`)
      .then((r) => r.json())
      .then((data) => {
        const list: Candidate[] = data.data?.candidates ?? [];
        setCandidates(list);
        const autoSelect = new Set(
          list.filter((c) => c.relevanceScore >= 0.5 && !c.alreadyImported).map((c) => c.externalId)
        );
        setSelected(autoSelect);
      })
      .catch(() => setError("Failed to scan. Check your connection."))
      .finally(() => setLoading(false));
  }, [open, connectorId, workspaceId]);

  const filtered = candidates.filter((c) => c.relevanceScore >= minScore);
  const unimported = filtered.filter((c) => !c.alreadyImported);

  function toggleAll() {
    const ids = new Set(unimported.map((c) => c.externalId));
    const allSelected = unimported.every((c) => selected.has(c.externalId));
    setSelected(allSelected ? new Set() : ids);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleImport() {
    const externalIds = [...selected];
    if (!externalIds.length) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/connectors/${connectorId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalIds }),
      });
      const data = await res.json();
      if (data.data?.imported !== undefined) {
        toast.success(`${data.data.imported} email${data.data.imported !== 1 ? "s" : ""} imported and queued for processing`);
        router.refresh();
        onClose();
      } else {
        toast.error("Import failed — try again");
      }
    } catch {
      toast.error("Import failed — try again");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card h-full flex flex-col shadow-2xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">Review {connectorName} candidates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pick which to import — only approved items become evidence</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        {!loading && candidates.length > 0 && (
          <div className="px-6 py-3 border-b border-border flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Min relevance:</span>
              {[0, 0.3, 0.5, 0.7].map((v) => (
                <button
                  key={v}
                  onClick={() => setMinScore(v)}
                  className={cn("px-2 py-0.5 rounded-full border font-medium transition-all", minScore === v ? "bg-indigo-600 text-white border-indigo-600" : "border-border hover:border-muted-foreground")}
                >
                  {v === 0 ? "All" : `${Math.round(v * 100)}%+`}
                </button>
              ))}
            </div>
            <button onClick={toggleAll} className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              {unimported.every((c) => selected.has(c.externalId)) ? "Deselect all" : "Select all"}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm">Scanning your {connectorName}…</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No candidates match this filter.</div>
          )}

          {!loading && filtered.map((c) => (
            <div
              key={c.externalId}
              onClick={() => !c.alreadyImported && toggle(c.externalId)}
              className={cn(
                "rounded-xl border p-4 transition-all",
                c.alreadyImported
                  ? "opacity-40 cursor-default border-border/50 bg-muted/20"
                  : selected.has(c.externalId)
                  ? "border-indigo-500/40 bg-indigo-500/5 cursor-pointer"
                  : "border-border hover:border-border/80 cursor-pointer hover:bg-muted/20"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 text-indigo-400">
                  {c.alreadyImported
                    ? <span className="text-xs text-muted-foreground font-medium">Imported</span>
                    : selected.has(c.externalId)
                    ? <CheckSquare className="h-4 w-4" />
                    : <Square className="h-4 w-4 text-muted-foreground/40" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{c.subject}</p>
                    <ScoreBadge score={c.relevanceScore} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-1.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.from}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.snippet}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 italic">{c.relevanceReason}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selected.size} selected · {candidates.filter((c) => c.alreadyImported).length} already imported
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={selected.size === 0 || importing}
              onClick={handleImport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {importing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</> : `Import ${selected.size} email${selected.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
