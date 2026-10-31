"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeShare } from "@/lib/prd/document";
import { graphStore } from "@/lib/graph/graph-store";
import { useUIStore } from "@/stores/ui-store";
import { clearSharedPrd, takeSharedPrd } from "@/components/prd/living-prd";

export function PendingPrd() {
  const router = useRouter();
  const productId = useUIStore((state) => state.activeProductId);
  const [token, setToken] = useState<string | null>(null);
  const share = token ? decodeShare(token) : null;

  useEffect(() => {
    setToken(takeSharedPrd());
  }, []);

  if (!share || !token) return null;

  function save() {
    const id = graphStore.getState().importSharedPrd(share!, productId || "product-workspace");
    clearSharedPrd();
    setToken(null);
    if (id) router.push(`/features/${id}`);
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 text-sm">
      <p>
        A living PRD was shared with you: <span className="font-medium">{share.title}</span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { clearSharedPrd(); setToken(null); }} className="text-xs text-muted-foreground">
          Dismiss
        </button>
        <button type="button" onClick={save} className="h-7 rounded-md bg-foreground px-2 text-xs text-background">
          Save to my graph
        </button>
      </div>
    </div>
  );
}
