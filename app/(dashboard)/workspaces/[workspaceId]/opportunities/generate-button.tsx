"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

export function GenerateOpportunitiesButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { running, steps, startJob } = useJob("generate-opportunities");

  function handleGenerate() {
    startJob(
      `/api/workspaces/${workspaceId}/opportunities/generate`,
      (result) => {
        const count = Number(result.count ?? 0);
        toast.success(`Generated ${count} opportunit${count === 1 ? "y" : "ies"}!`);
        router.refresh();
      },
      (msg) => toast.error(msg)
    );
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <Button
        onClick={handleGenerate}
        disabled={running}
        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {running ? "Generating…" : "Generate Opportunities"}
      </Button>
      {steps.length > 0 && <ProgressStream steps={steps} className="w-72 self-end" />}
    </div>
  );
}
