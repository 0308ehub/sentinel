"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wand2, FileText, FileType, FileSpreadsheet, FileCode, File } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { DeleteDocumentButton } from "./delete-document-button";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/20",
  PARSING: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  CHUNKING: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  EMBEDDING: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  EXTRACTING: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
};

function FileIcon({ fileType, sourceType }: { fileType?: string | null; sourceType: string }) {
  const ft = (fileType ?? "").toLowerCase();
  const iconClass = "h-8 w-8 shrink-0";
  if (ft.includes("pdf"))
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-red-500/10"><FileType className={cn(iconClass, "text-red-400 h-5 w-5")} /></div>;
  if (ft.includes("csv") || ft.includes("xlsx") || ft.includes("xls") || ft.includes("spreadsheet"))
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-green-500/10"><FileSpreadsheet className={cn(iconClass, "text-green-400 h-5 w-5")} /></div>;
  if (ft.includes("json") || ft.includes("xml") || ft.includes("html") || ft.includes("code"))
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-blue-500/10"><FileCode className={cn(iconClass, "text-blue-400 h-5 w-5")} /></div>;
  if (sourceType === "SUPPORT_TICKET" || sourceType === "SALES_CALL" || sourceType === "CUSTOMER_INTERVIEW")
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-indigo-500/10"><FileText className={cn(iconClass, "text-indigo-400 h-5 w-5")} /></div>;
  return <div className="flex items-center justify-center w-9 h-9 rounded bg-muted"><File className={cn(iconClass, "text-muted-foreground h-5 w-5")} /></div>;
}

export interface DocumentRowProps {
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

const PROCESSING_STATUSES = new Set(["PENDING", "PARSING", "CHUNKING", "EMBEDDING", "EXTRACTING"]);

export function DocumentRow({ doc }: { doc: DocumentRowProps }) {
  const router = useRouter();
  const [status, setStatus] = useState(doc.status);
  const [chunkCount, setChunkCount] = useState(doc.chunkCount);
  const [reprocessing, setReprocessing] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    if (!PROCESSING_STATUSES.has(status)) {
      stopPolling();
      return;
    }

    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`);
        if (!res.ok) return;
        const json = await res.json();
        const newStatus: string = json.data?.status;
        const newChunkCount: number = json.data?.chunkCount ?? chunkCount;
        if (newStatus) setStatus(newStatus);
        if (newChunkCount !== chunkCount) setChunkCount(newChunkCount);
        if (!PROCESSING_STATUSES.has(newStatus)) {
          stopPolling();
          router.refresh();
        }
      } catch {
        // network blip — keep polling
      }
    }, 3000);

    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleReprocess() {
    setReprocessing(true);
    setStatus("EXTRACTING");
    try {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
      if (res.ok) {
        toast.success("Document queued for reprocessing");
        router.refresh();
      } else {
        setStatus(doc.status);
        toast.error("Failed to reprocess");
      }
    } catch {
      setStatus(doc.status);
      toast.error("Failed to reprocess");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleReextract() {
    setReextracting(true);
    setStatus("EXTRACTING");
    try {
      const res = await fetch(`/api/documents/${doc.id}/reextract`, { method: "POST" });
      if (res.ok) {
        toast.success("Re-extracting insights — chunks and embeddings kept");
      } else {
        setStatus(doc.status);
        toast.error("Failed to re-extract");
      }
    } catch {
      setStatus(doc.status);
      toast.error("Failed to re-extract");
    } finally {
      setReextracting(false);
    }
  }

  const canReprocess = status === "FAILED" || status === "COMPLETED" || status === "PENDING" || status === "EXTRACTING";
  const canReextract = status === "COMPLETED";

  return (
    <div className="group grid grid-cols-[1fr_160px_120px_80px_160px_100px] gap-4 px-3 py-3 rounded-lg hover:bg-muted/40 border border-transparent hover:border-border items-center transition-all">
      {/* Name + icon */}
      <Link href={`/workspaces/${doc.workspaceId}/documents/${doc.id}`} className="flex items-center gap-3 min-w-0">
        <FileIcon fileType={doc.fileType} sourceType={doc.sourceType} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:text-indigo-400 transition-colors" title={doc.title}>
            {doc.title}
          </p>
          {doc.uploaderName && (
            <p className="text-xs text-muted-foreground/70 truncate">{doc.uploaderName}</p>
          )}
        </div>
      </Link>

      {/* Source type */}
      <div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
          {doc.sourceType.replace(/_/g, " ")}
        </span>
      </div>

      {/* Status */}
      <div>
        <span
          title={status === "FAILED" && doc.errorMessage ? doc.errorMessage : undefined}
          className={cn("text-xs px-2 py-0.5 rounded-full font-medium border cursor-default", STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border")}
        >
          {status}
        </span>
        {status === "FAILED" && doc.errorMessage && (
          <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={doc.errorMessage}>
            {doc.errorMessage}
          </p>
        )}
      </div>

      {/* Chunks */}
      <div className="text-sm text-muted-foreground">{chunkCount}</div>

      {/* Uploaded */}
      <div className="text-xs text-muted-foreground/70">{formatDate(doc.createdAt)}</div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {canReextract && (
          <Button size="sm" variant="ghost" onClick={handleReextract} disabled={reextracting} title="Re-extract insights (keeps chunks & embeddings)" className="h-7 w-7 p-0 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10">
            <Wand2 className={cn("h-3.5 w-3.5", reextracting && "animate-pulse")} />
          </Button>
        )}
        {canReprocess && (
          <Button size="sm" variant="ghost" onClick={handleReprocess} disabled={reprocessing} title="Reprocess (re-parse, re-embed, re-extract)" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted">
            <RefreshCw className={cn("h-3.5 w-3.5", reprocessing && "animate-spin")} />
          </Button>
        )}
        <DeleteDocumentButton documentId={doc.id} />
      </div>
    </div>
  );
}
