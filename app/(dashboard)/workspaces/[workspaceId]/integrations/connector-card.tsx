"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ConnectorMeta {
  type: string;
  name: string;
  description: string;
  icon: string;
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

export function ConnectorCard({
  connector,
  meta,
  workspaceId,
}: {
  connector: Connector;
  meta: ConnectorMeta;
  workspaceId: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastLog = connector.syncLogs[0];

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/connectors/${connector.id}/sync`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  }

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
    <Card className={cn("border", meta.color)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{connector.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusIcon className={cn("h-3 w-3", s.color)} />
                <span className={cn("text-xs font-medium", s.color)}>{s.label}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {connector.errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 rounded p-2 mb-3">{connector.errorMessage}</p>
        )}

        {lastLog && (
          <div className="text-xs text-gray-500 mb-3">
            Last sync: {formatDate(lastLog.startedAt)} ·{" "}
            <span className={lastLog.status === "FAILED" ? "text-red-500" : "text-emerald-600"}>
              {lastLog.status === "COMPLETED"
                ? `${lastLog.documentsImported} docs imported`
                : lastLog.status}
            </span>
          </div>
        )}

        {!lastLog && connector.lastSyncedAt && (
          <p className="text-xs text-gray-500 mb-3">Last synced {formatDate(connector.lastSyncedAt)}</p>
        )}

        {!lastLog && !connector.lastSyncedAt && (
          <p className="text-xs text-gray-400 mb-3">Never synced — click Sync to import data</p>
        )}

        <Button
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="w-full gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs"
          variant="outline"
        >
          {syncing ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Syncing…</>
          ) : (
            <><RefreshCw className="h-3 w-3" /> Sync Now</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
