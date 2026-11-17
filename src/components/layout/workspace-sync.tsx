"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  retryWorkspaceSync,
  startWorkspaceSync,
  useWorkspaceSyncStatus,
} from "@/lib/workspace/sync-client";

export function WorkspaceSync() {
  const status = useWorkspaceSyncStatus();

  useEffect(() => {
    startWorkspaceSync();
  }, []);

  if (status !== "error" && status !== "local-only") return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm"
    >
      <span>Changes are saved on this device only.</span>
      {status === "error" && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={retryWorkspaceSync}>
          Retry
        </Button>
      )}
    </div>
  );
}
