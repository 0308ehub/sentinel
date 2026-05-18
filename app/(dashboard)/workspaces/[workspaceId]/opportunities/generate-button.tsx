"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function GenerateOpportunitiesButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/opportunities/generate`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to generate opportunities");
      const count = Array.isArray(data.data) ? data.data.length : 0;
      toast.success(`Generated ${count} new opportunit${count === 1 ? "y" : "ies"}!`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading}
      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {loading ? "Generating…" : "Generate Opportunities"}
    </Button>
  );
}
