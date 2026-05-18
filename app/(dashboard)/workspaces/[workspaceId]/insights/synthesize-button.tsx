"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function SynthesizeButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSynthesize() {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/synthesize`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Synthesis failed");
      toast.success("Workspace synthesized! Insights updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Synthesis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleSynthesize}
      disabled={loading}
      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {loading ? "Synthesizing…" : "Synthesize Workspace"}
    </Button>
  );
}
