"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ReprocessAllButton({ stuckIds }: { stuckIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(0);

  async function handleClick() {
    setLoading(true);
    setDone(0);
    let count = 0;
    for (const id of stuckIds) {
      try {
        await fetch(`/api/documents/${id}/reprocess`, { method: "POST" });
        count++;
        setDone(count);
      } catch {
        // continue with others
      }
    }
    toast.success(`${count} document${count !== 1 ? "s" : ""} requeued for processing`);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2 disabled:opacity-60 transition-colors"
    >
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Reprocessing {done}/{stuckIds.length}…</>
      ) : (
        <><RefreshCw className="h-3 w-3" /> Reprocess all {stuckIds.length} stuck</>
      )}
    </button>
  );
}
