"use client";

import { useEffect, useState } from "react";
import { usePipelineContext } from "./pipeline-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Zap,
  Check,
  Minus,
  X,
  Loader2,
  Upload,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { PipelineStep } from "./pipeline-context";

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  if (status === "running")
    return <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />;
  if (status === "done")
    return <Check className="h-3 w-3 text-emerald-400 shrink-0" />;
  if (status === "skipped")
    return <Minus className="h-3 w-3 text-muted-foreground/40 shrink-0" />;
  if (status === "failed")
    return <X className="h-3 w-3 text-red-400 shrink-0" />;
  return (
    <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
  );
}

export function PipelineBanner({ workspaceId }: { workspaceId: string }) {
  const {
    idle,
    checking,
    running,
    done,
    failed,
    steps,
    errorMessage,
    statusError,
    dismissed,
    runPipeline,
    dismiss,
  } = usePipelineContext();

  const [previewSteps, setPreviewSteps] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [previewChecking, setPreviewChecking] = useState(true);
  const [previewCanRun, setPreviewCanRun] = useState<boolean | null>(null);
  const [previewBlockedReason, setPreviewBlockedReason] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (dismissed) {
        setPreviewChecking(false);
        return;
      }
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/pipeline/status`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setPreviewCanRun(data.canRun);
        setPreviewBlockedReason(data.blockedReason);
        setPreviewSteps(
          (data.steps as Array<{ needsRun: boolean; key: string; label: string }>)
            .filter((s) => s.needsRun)
        );
      } catch {
        // ignore — banner stays in loading state
      } finally {
        if (!cancelled) setPreviewChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (dismissed) return null;

  if (
    !previewChecking &&
    previewCanRun === false &&
    (previewBlockedReason === "Everything is up to date" ||
      previewBlockedReason === "Upload documents first")
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-card border border-indigo-500/25 rounded-xl overflow-hidden shadow-sm transition-opacity duration-700",
        done ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      {/* Pre-run / idle state */}
      {idle && (
        <div className="border-l-2 border-indigo-500 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Sentinel is ready to analyze your workspace
                </p>
                {previewChecking ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Checking what needs to run…
                  </p>
                ) : previewCanRun === false && previewBlockedReason ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {previewBlockedReason}
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-0.5">
                    {previewSteps.map((s) => (
                      <li
                        key={s.key}
                        className="text-xs text-muted-foreground flex items-center gap-1.5"
                      >
                        <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {statusError ? (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Couldn&apos;t check status
                </p>
              ) : previewCanRun === false &&
                previewBlockedReason === "Upload documents first" ? (
                <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5 border-indigo-500/30"
                  >
                    <Upload className="h-3 w-3" /> Upload documents
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  onClick={runPipeline}
                  disabled={previewChecking || previewCanRun === false}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                >
                  <Zap className="h-3 w-3" /> Run Sentinel
                </Button>
              )}
              <button
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss pipeline banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checking state */}
      {checking && (
        <div className="border-l-2 border-indigo-500 px-5 py-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Checking what needs to run…
          </p>
        </div>
      )}

      {/* Running / failed state */}
      {(running || failed) && steps.length > 0 && (
        <div className="border-l-2 border-indigo-500 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              {running ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  Running Sentinel…
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                  Pipeline stopped
                </>
              )}
            </p>
            {failed && (
              <Button
                size="sm"
                onClick={runPipeline}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {steps.map((step) => (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  step.status === "running" && "text-foreground animate-pulse",
                  step.status === "done" && "text-muted-foreground",
                  step.status === "skipped" && "text-muted-foreground/40",
                  step.status === "failed" && "text-red-400",
                  step.status === "pending" && "text-muted-foreground/50"
                )}
              >
                <StepIcon status={step.status} />
                {step.label}
              </div>
            ))}
          </div>
          {failed && errorMessage && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {/* Completion state */}
      {done && (
        <div className="border-l-2 border-emerald-500 px-5 py-4 flex items-center gap-3">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-foreground">
            Pipeline complete ·{" "}
            <span className="text-muted-foreground">
              {steps.filter((s) => s.status === "done").length} step
              {steps.filter((s) => s.status === "done").length !== 1 ? "s" : ""}{" "}
              ran
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
