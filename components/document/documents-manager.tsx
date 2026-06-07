"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  File,
  FileType,
  FileSpreadsheet,
  FileCode,
  FileText,
  RefreshCw,
  Wand2,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DocumentItem {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  sourceType: string;
  fileType?: string | null;
  chunkCount: number;
  createdAt: Date;
  uploaderName?: string | null;
  errorMessage?: string;
}

type SortKey = "title" | "sourceType" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  FAILED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  PARSING: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  CHUNKING: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  EMBEDDING: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
};

function FileIcon({ fileType, sourceType }: { fileType?: string | null; sourceType: string }) {
  const ft = (fileType ?? "").toLowerCase();
  if (ft.includes("pdf"))
    return <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-50 dark:bg-red-950 shrink-0"><FileType className="h-4 w-4 text-red-500" /></div>;
  if (ft.includes("csv") || ft.includes("xlsx") || ft.includes("spreadsheet"))
    return <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950 shrink-0"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /></div>;
  if (ft.includes("json") || ft.includes("xml") || ft.includes("html") || ft.includes("code"))
    return <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950 shrink-0"><FileCode className="h-4 w-4 text-blue-500" /></div>;
  if (sourceType === "SUPPORT_TICKET" || sourceType === "SALES_CALL" || sourceType === "CUSTOMER_INTERVIEW")
    return <div className="flex items-center justify-center w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-950 shrink-0"><FileText className="h-4 w-4 text-indigo-500" /></div>;
  return <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0"><File className="h-4 w-4 text-muted-foreground" /></div>;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 text-indigo-500" />
    : <ArrowDown className="h-3 w-3 text-indigo-500" />;
}

const STATUS_FILTER_OPTIONS = ["All", "COMPLETED", "FAILED", "PENDING", "EMBEDDING"] as const;

interface DocRowProps {
  doc: DocumentItem;
  selected: boolean;
  onToggle: (id: string) => void;
}

function DocRow({ doc, selected, onToggle }: DocRowProps) {
  const router = useRouter();
  const [reprocessing, setReprocessing] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
      if (res.ok) { toast.success("Document queued for reprocessing"); router.refresh(); }
      else toast.error("Failed to reprocess");
    } catch { toast.error("Failed to reprocess"); }
    finally { setReprocessing(false); }
  };

  const handleReextract = async () => {
    setReextracting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reextract`, { method: "POST" });
      if (res.ok) toast.success("Re-extracting insights");
      else toast.error("Failed to re-extract");
    } catch { toast.error("Failed to re-extract"); }
    finally { setReextracting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Document deleted"); router.refresh(); }
      else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(false); setConfirming(false); }
  };

  const canReprocess = ["FAILED", "COMPLETED", "PENDING"].includes(doc.status);
  const canReextract = doc.status === "COMPLETED";

  return (
    <div
      className={cn(
        "group grid grid-cols-[32px_1fr_140px_110px_56px_140px_120px] gap-3 px-4 py-3 items-center border-b border-border/60 last:border-0 transition-colors",
        selected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : "hover:bg-muted/40"
      )}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(doc.id)}
          className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      </div>

      {/* Name */}
      <Link
        href={`/workspaces/${doc.workspaceId}/documents/${doc.id}`}
        className="flex items-center gap-2.5 min-w-0"
      >
        <FileIcon fileType={doc.fileType} sourceType={doc.sourceType} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate" title={doc.title}>
            {doc.title}
          </p>
          {doc.uploaderName && (
            <p className="text-xs text-muted-foreground truncate">{doc.uploaderName}</p>
          )}
        </div>
      </Link>

      {/* Source */}
      <div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
          {doc.sourceType.replace(/_/g, " ")}
        </span>
      </div>

      {/* Status */}
      <div>
        <span
          title={doc.status === "FAILED" && doc.errorMessage ? doc.errorMessage : undefined}
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium border cursor-default",
            STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground border-border"
          )}
        >
          {doc.status.toLowerCase()}
        </span>
      </div>

      {/* Chunks */}
      <div className="text-xs text-muted-foreground tabular-nums">{doc.chunkCount}</div>

      {/* Date */}
      <div className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5">
        {confirming ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Delete?</span>
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}
              className="h-6 px-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
              {deleting ? "…" : "Yes"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}
              className="h-6 px-1.5 text-xs text-muted-foreground">
              No
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canReextract && (
              <Button size="sm" variant="ghost" onClick={handleReextract} disabled={reextracting}
                title="Re-extract insights" className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950">
                <Wand2 className={cn("h-3.5 w-3.5", reextracting && "animate-pulse")} />
              </Button>
            )}
            {canReprocess && (
              <Button size="sm" variant="ghost" onClick={handleReprocess} disabled={reprocessing}
                title="Reprocess document" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted">
                <RefreshCw className={cn("h-3.5 w-3.5", reprocessing && "animate-spin")} />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}
              title="Delete" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const IN_PROGRESS_STATUSES = new Set(["PENDING", "PARSING", "CHUNKING", "EMBEDDING", "EXTRACTING"]);

export function DocumentsManager({
  documents,
  workspaceId,
}: {
  documents: DocumentItem[];
  workspaceId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const hasInProgress = documents.some((d) => IN_PROGRESS_STATUSES.has(d.status));
  useEffect(() => {
    if (!hasInProgress) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [hasInProgress, router]);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "All") return documents;
    return documents.filter((d) => d.status === statusFilter);
  }, [documents, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title" || sortKey === "sourceType" || sortKey === "status") {
        cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      } else if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((d) => d.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (!selected.size || bulkDeleting) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        [...selected].map((id) => fetch(`/api/documents/${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${selected.size} document${selected.size > 1 ? "s" : ""} deleted`);
      } else {
        toast.error(`${failed} of ${selected.size} deletions failed`);
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
    >
      {label}
      <SortIcon active={sortKey === field} dir={sortDir} />
    </button>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {documents.length} evidence source{documents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href={`/workspaces/${workspaceId}/documents/upload`}>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => { setStatusFilter(opt); setSelected(new Set()); }}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors font-medium",
                statusFilter === opt
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {opt === "All" ? `All (${documents.length})` : opt.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              {statusFilter === "All" ? "No documents yet" : `No ${statusFilter.toLowerCase()} documents`}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              {statusFilter === "All"
                ? "Upload customer interviews, support tickets, or feedback exports."
                : "Try a different filter."}
            </p>
            {statusFilter === "All" && (
              <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Upload first document</Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[32px_1fr_140px_110px_56px_140px_120px] gap-3 px-4 py-2.5 items-center border-b border-border sticky top-0 bg-card/95 backdrop-blur-sm z-10">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <SortHeader label="Name" field="title" />
            <SortHeader label="Source" field="sourceType" />
            <SortHeader label="Status" field="status" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chunks</span>
            <SortHeader label="Uploaded" field="createdAt" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Actions</span>
          </div>

          {/* Rows */}
          <div>
            {sorted.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                selected={selected.has(doc.id)}
                onToggle={toggleOne}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="shrink-0 border-t border-border bg-card px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {selected.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={bulkDelete}
            disabled={bulkDeleting}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleting ? "Deleting…" : `Delete ${selected.size}`}
          </Button>
        </div>
      )}
    </div>
  );
}
