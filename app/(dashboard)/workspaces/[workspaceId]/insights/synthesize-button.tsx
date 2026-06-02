"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

export function SynthesizeButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { running, steps, startJob, cancelJob } = useJob("synthesize");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  function handleSynthesize() {
    startJob(
      `/api/workspaces/${workspaceId}/synthesize`,
      (result) => {
        toast.success(
          `Synthesis complete — ${result.painPoints ?? 0} pain points, ${result.opportunities ?? 0} opportunities`
        );
        router.refresh();
      },
      (msg) => toast.error(msg)
    );
  }

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/synthesis`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to clear");
      const d = data.data?.deleted ?? {};
      toast.success(`Cleared — ${d.painPoints ?? 0} pain points, ${d.insights ?? 0} insights, ${d.opportunities ?? 0} opportunities`);
      cancelJob();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-2">
        {/* Clear synthesis */}
        {confirmingClear ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Remove all insights &amp; opportunities?</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              disabled={clearing}
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, clear"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingClear(false)}
              disabled={clearing}
              className="h-7 px-2 text-xs text-gray-500"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmingClear(true)}
            disabled={running}
            className="gap-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Synthesis
          </Button>
        )}

        <Button
          onClick={handleSynthesize}
          disabled={running}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {running ? "Synthesizing…" : "Synthesize Workspace"}
        </Button>
      </div>

      {steps.length > 0 && <ProgressStream steps={steps} className="w-72 self-end" />}
    </div>
  );
}
