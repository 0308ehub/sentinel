"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

export function DigestGenerateButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { running, steps, startJob } = useJob("generate-digest");

  function handleGenerate() {
    startJob(
      `/api/workspaces/${workspaceId}/digests`,
      () => {
        toast.success("Digest generated!");
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
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Generate Now
          </>
        )}
      </Button>
      {steps.length > 0 && <ProgressStream steps={steps} className="w-72 self-end" />}
    </div>
  );
}
