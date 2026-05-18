"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function ReprocessButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/reprocess`, { method: "POST" });
      if (res.ok) {
        toast.success("Document queued for reprocessing");
      } else {
        toast.error("Failed to reprocess");
      }
    } catch {
      toast.error("Failed to reprocess");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={handleClick} disabled={loading} className="gap-1.5 text-xs">
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      Reprocess
    </Button>
  );
}
