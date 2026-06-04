"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useJob } from "../workspace-jobs-context";

interface SynthesisStatus {
  lastSynthesizedAt: string | null;
  painPointCount: number;
  pendingDocCount: number;
  newDocsSinceLastSynthesis: number;
}

export function SynthesisUpdateWatcher({
  workspaceId,
  initialStatus,
}: {
  workspaceId: string;
  initialStatus: SynthesisStatus;
}) {
  const router = useRouter();
  const { running, startJob } = useJob("synthesize");
  const [status, setStatus] = useState(initialStatus);
  const seenSynthesizedAt = useRef(initialStatus.lastSynthesizedAt);
  const triggered = useRef(false);

  useEffect(() => {
    // Nothing to watch — no pending docs and no new docs to pick up
    if (status.pendingDocCount === 0 && status.newDocsSinceLastSynthesis === 0) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/synthesis/status`);
        if (!res.ok) return;
        const data: SynthesisStatus = await res.json();
        setStatus(data);

        // A background synthesis completed (e.g. server-side cron) — refresh the page
        if (data.lastSynthesizedAt !== seenSynthesizedAt.current && !running) {
          seenSynthesizedAt.current = data.lastSynthesizedAt;
          router.refresh();
          return;
        }

        // All docs finished processing and there are new ones since last synthesis —
        // auto-trigger a re-synthesis so results improve without user clicking again.
        if (
          !triggered.current &&
          !running &&
          data.pendingDocCount === 0 &&
          data.newDocsSinceLastSynthesis > 0 &&
          data.lastSynthesizedAt !== null
        ) {
          triggered.current = true;
          startJob(
            `/api/workspaces/${workspaceId}/synthesize`,
            (result) => {
              toast.success(
                `Insights updated — ${result.painPoints ?? 0} pain points, ${result.opportunities ?? 0} opportunities`
              );
              router.refresh();
            },
            () => {
              // Silent failure — user can manually re-synthesize
            }
          );
        }
      } catch {
        // ignore transient poll errors
      }
    };

    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [workspaceId, status.pendingDocCount, status.newDocsSinceLastSynthesis, running, startJob, router]);

  if (status.pendingDocCount === 0) return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Processing {status.pendingDocCount} document
      {status.pendingDocCount !== 1 ? "s" : ""}…
    </span>
  );
}
