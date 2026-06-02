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
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  PARSING: "bg-blue-50 text-blue-700 border-blue-200",
  CHUNKING: "bg-blue-50 text-blue-700 border-blue-200",
  EMBEDDING: "bg-blue-50 text-blue-700 border-blue-200",
  EXTRACTING: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function FileIcon({ fileType, sourceType }: { fileType?: string | null; sourceType: string }) {
  const ft = (fileType ?? "").toLowerCase();
  const iconClass = "h-8 w-8 shrink-0";
  if (ft.includes("pdf"))
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-red-50"><FileType className={cn(iconClass, "text-red-500 h-5 w-5")} /></div>;
  if (ft.includes("csv") || ft.includes("xlsx") || ft.includes("xls") || ft.includes("spreadsheet"))
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-green-50"><FileSpreadsheet className={cn(iconClass, "text-green-600 h-5 w-5")} /></div>;
  if (ft.includes("json") || ft.includes("xml") || ft.includes("html") || ft.includes("code"))
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-blue-50"><FileCode className={cn(iconClass, "text-blue-500 h-5 w-5")} /></div>;
  if (sourceType === "SUPPORT_TICKET" || sourceType === "SALES_CALL" || sourceType === "CUSTOMER_INTERVIEW")
    return <div className="flex items-center justify-center w-9 h-9 rounded bg-indigo-50"><FileText className={cn(iconClass, "text-indigo-500 h-5 w-5")} /></div>;
  return <div className="flex items-center justify-center w-9 h-9 rounded bg-gray-100"><File className={cn(iconClass, "text-gray-400 h-5 w-5")} /></div>;
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

    // Already polling — don't start a second interval
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
          router.refresh(); // sync server component counts in header
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
    <div className="group grid grid-cols-[1fr_160px_120px_80px_160px_100px] gap-4 px-3 py-3 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 items-center transition-all">
      {/* Name + icon */}
      <Link href={`/workspaces/${doc.workspaceId}/documents/${doc.id}`} className="flex items-center gap-3 min-w-0">
        <FileIcon fileType={doc.fileType} sourceType={doc.sourceType} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors" title={doc.title}>
            {doc.title}
          </p>
          {doc.uploaderName && (
            <p className="text-xs text-gray-400 truncate">{doc.uploaderName}</p>
          )}
        </div>
      </Link>

      {/* Source type */}
      <div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-medium">
          {doc.sourceType.replace(/_/g, " ")}
        </span>
      </div>

      {/* Status */}
      <div>
        <span
          title={status === "FAILED" && doc.errorMessage ? doc.errorMessage : undefined}
          className={cn("text-xs px-2 py-0.5 rounded-full font-medium border cursor-default", STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200")}
        >
          {status}
        </span>
        {status === "FAILED" && doc.errorMessage && (
          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={doc.errorMessage}>
            {doc.errorMessage}
          </p>
        )}
      </div>

      {/* Chunks */}
      <div className="text-sm text-gray-500">{chunkCount}</div>

      {/* Uploaded */}
      <div className="text-xs text-gray-400">{formatDate(doc.createdAt)}</div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {canReextract && (
          <Button size="sm" variant="ghost" onClick={handleReextract} disabled={reextracting} title="Re-extract insights (keeps chunks & embeddings)" className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50">
            <Wand2 className={cn("h-3.5 w-3.5", reextracting && "animate-pulse")} />
          </Button>
        )}
        {canReprocess && (
          <Button size="sm" variant="ghost" onClick={handleReprocess} disabled={reprocessing} title="Reprocess (re-parse, re-embed, re-extract)" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <RefreshCw className={cn("h-3.5 w-3.5", reprocessing && "animate-spin")} />
          </Button>
        )}
        <DeleteDocumentButton documentId={doc.id} />
      </div>
    </div>
  );
}
