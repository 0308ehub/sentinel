"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle, AlertCircle, Clock, Loader2, ListFilter } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ConnectorIcon } from "@/components/integrations/ConnectorIcons";
import { ReviewDrawer } from "@/components/integrations/ReviewDrawer";

interface ConnectorMeta {
  type: string;
  name: string;
  description: string;
  color: string;
}

interface SyncLog {
  id: string;
  status: string;
  documentsImported: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

interface Connector {
  id: string;
  type: string;
  name: string;
  status: string;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  syncLogs: SyncLog[];
}

export function ConnectorCard({ connector, meta, workspaceId }: { connector: Connector; meta: ConnectorMeta; workspaceId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const lastLog = connector.syncLogs[0];

  const HAS_REVIEW = connector.type === "GMAIL" || connector.type === "SLACK";

  async function handleDelete() {
    if (!confirm(`Disconnect ${meta.name}? Imported documents will remain.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/connectors/${connector.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const statusConfig = {
    ACTIVE: { label: "Active", icon: CheckCircle, color: "text-emerald-600" },
    PENDING: { label: "Pending", icon: Clock, color: "text-amber-600" },
    ERROR: { label: "Error", icon: AlertCircle, color: "text-red-600" },
    NEEDS_REAUTH: { label: "Reconnect needed", icon: AlertCircle, color: "text-orange-600" },
    PAUSED: { label: "Paused", icon: Clock, color: "text-gray-500" },
  };
  const s = statusConfig[connector.status as keyof typeof statusConfig] ?? statusConfig.PENDING;
  const StatusIcon = s.icon;

  return (
    <>
      <div className={cn("rounded-2xl border p-5 flex flex-col gap-4", meta.color)}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-background shadow-sm flex items-center justify-center p-1.5 shrink-0">
              <ConnectorIcon type={connector.type} className="w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm leading-tight truncate">{connector.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusIcon className={cn("h-3 w-3 shrink-0", s.color)} />
                <span className={cn("text-xs font-medium", s.color)}>{s.label}</span>
              </div>
            </div>
          </div>
          <button onClick={handleDelete} disabled={deleting} className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg shrink-0">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {connector.errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{connector.errorMessage}</p>
        )}

        <div className="text-xs text-gray-500">
          {lastLog ? (
            <>Last sync: {formatDate(lastLog.startedAt)} · <span className={lastLog.status === "FAILED" ? "text-red-500" : "text-emerald-600 font-medium"}>{lastLog.status === "COMPLETED" ? `${lastLog.documentsImported} docs imported` : lastLog.status}</span></>
          ) : connector.lastSyncedAt ? (
            <>Last synced {formatDate(connector.lastSyncedAt)}</>
          ) : (
            <span className="text-gray-400">Never synced</span>
          )}
        </div>

        {HAS_REVIEW ? (
          <Button size="sm" onClick={() => setReviewOpen(true)} className="w-full gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs" variant="outline">
            <ListFilter className="h-3.5 w-3.5" /> Review & Import
          </Button>
        ) : null}
      </div>

      {HAS_REVIEW && (
        <ReviewDrawer
          connectorId={connector.id}
          workspaceId={workspaceId}
          connectorName={meta.name}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </>
  );
}
