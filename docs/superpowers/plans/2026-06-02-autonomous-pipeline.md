# Autonomous Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Run Sentinel" pipeline that detects stale data, runs all analysis steps sequentially, and populates every tab automatically.

**Architecture:** Client-side orchestration hook (`usePipeline`) lives inside a `PipelineProvider` in the workspace shell. The provider shares pipeline state via `PipelineContext` so both the nav (for pulsing dots) and the overview banner can read it. Individual SSE steps reuse the existing `startJob` infrastructure; the PRD and summary steps use direct `fetch` since those routes return JSON, not SSE.

**Tech Stack:** Next.js App Router, TypeScript, Prisma ORM, existing `WorkspaceJobsContext`, Tailwind CSS, lucide-react

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `app/api/workspaces/[workspaceId]/pipeline/status/route.ts` | Create | Staleness check — returns which steps need to run and metadata for the hook |
| `app/(dashboard)/workspaces/[workspaceId]/pipeline-context.tsx` | Create | Types, context, provider, `usePipelineContext` hook, all pipeline logic |
| `app/(dashboard)/workspaces/[workspaceId]/pipeline-banner.tsx` | Create | Overview page banner — pre-run, running, and completion states |
| `app/(dashboard)/workspaces/[workspaceId]/workspace-shell.tsx` | Modify | Add `PipelineProvider` inside `WorkspaceJobsProvider` |
| `app/(dashboard)/workspaces/[workspaceId]/page.tsx` | Modify | Import and render `PipelineBanner` above the stats row |
| `components/nav/workspace-nav.tsx` | Modify | Add pulsing indigo dots for tabs whose pipeline step is running |

---

## Task 1 — Status API endpoint

**Files:**
- Create: `app/api/workspaces/[workspaceId]/pipeline/status/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/workspaces/\[workspaceId\]/pipeline/status
touch app/api/workspaces/\[workspaceId\]/pipeline/status/route.ts
```

- [ ] **Step 2: Write the route**

```typescript
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";

export type PipelineStepKey = "synthesize" | "opportunities" | "prd" | "tickets" | "summary";

export interface PipelineStatusStep {
  key: PipelineStepKey;
  needsRun: boolean;
  label: string;
  reason: string;
}

export interface PipelineStatusResponse {
  canRun: boolean;
  blockedReason: string | null;
  steps: PipelineStatusStep[];
  topOpportunityId: string | null;
  latestPrdId: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      completedDocCount,
      latestCompletedDoc,
      painPointAggregate,
      opportunityCount,
      topOpportunity,
      ticketCount,
      latestPRD,
      recentSummary,
    ] = await Promise.all([
      prisma.document.count({ where: { workspaceId, status: "COMPLETED" } }),
      prisma.document.findFirst({
        where: { workspaceId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.painPoint.aggregate({
        where: { workspaceId },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      prisma.opportunity.count({ where: { workspaceId } }),
      prisma.opportunity.findFirst({
        where: { workspaceId },
        orderBy: { totalScore: "desc" },
        include: { prds: { select: { id: true }, take: 1 } },
      }),
      prisma.engineeringTicket.count({ where: { workspaceId } }),
      prisma.pRD.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.productEvent.findFirst({
        where: {
          workspaceId,
          event: "EXECUTIVE_SUMMARY",
          createdAt: { gte: sevenDaysAgo },
        },
        select: { id: true },
      }),
    ]);

    if (completedDocCount === 0) {
      return Response.json({
        canRun: false,
        blockedReason: "Upload documents first",
        steps: [],
        topOpportunityId: null,
        latestPrdId: null,
      } satisfies PipelineStatusResponse);
    }

    const painPointCount = painPointAggregate._count.id;
    const maxPainPointAt = painPointAggregate._max.createdAt;

    const synthesizeNeedsRun =
      painPointCount === 0 ||
      (latestCompletedDoc !== null &&
        maxPainPointAt !== null &&
        latestCompletedDoc.createdAt > maxPainPointAt);

    const opportunitiesNeedsRun =
      synthesizeNeedsRun || (painPointCount > 0 && opportunityCount === 0);

    const prdNeedsRun =
      topOpportunity !== null && topOpportunity.prds.length === 0;

    const ticketsNeedsRun = latestPRD !== null && ticketCount === 0;

    const summaryNeedsRun = recentSummary === null && opportunityCount > 0;

    const steps: PipelineStatusStep[] = [
      {
        key: "synthesize",
        needsRun: synthesizeNeedsRun,
        label: "Synthesize insights",
        reason: synthesizeNeedsRun
          ? painPointCount === 0
            ? "No insights yet"
            : "New documents since last run"
          : "Already up to date",
      },
      {
        key: "opportunities",
        needsRun: opportunitiesNeedsRun,
        label: "Generate opportunities",
        reason: opportunitiesNeedsRun
          ? opportunityCount === 0
            ? "No opportunities yet"
            : "Will run after synthesis"
          : "Already up to date",
      },
      {
        key: "prd",
        needsRun: prdNeedsRun,
        label: "Generate PRD",
        reason: prdNeedsRun
          ? "Top opportunity has no PRD"
          : topOpportunity === null
          ? "No opportunities yet"
          : "PRD already exists",
      },
      {
        key: "tickets",
        needsRun: ticketsNeedsRun,
        label: "Generate tickets",
        reason: ticketsNeedsRun
          ? "No tickets yet"
          : ticketCount > 0
          ? `${ticketCount} tickets already exist`
          : "No PRD yet",
      },
      {
        key: "summary",
        needsRun: summaryNeedsRun,
        label: "Executive summary",
        reason: summaryNeedsRun
          ? "No summary in the last 7 days"
          : recentSummary !== null
          ? "Generated recently"
          : "No opportunities yet",
      },
    ];

    const anyNeedsRun = steps.some((s) => s.needsRun);

    return Response.json({
      canRun: anyNeedsRun,
      blockedReason: anyNeedsRun ? null : "Everything is up to date",
      steps,
      topOpportunityId: topOpportunity?.id ?? null,
      latestPrdId: latestPRD?.id ?? null,
    } satisfies PipelineStatusResponse);
  } catch (error) {
    console.error("[pipeline/status]", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
```

- [ ] **Step 3: Verify the route compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "pipeline/status" | head -20
```

Expected: no errors for this file.

- [ ] **Step 4: Commit**

```bash
git add app/api/workspaces/\[workspaceId\]/pipeline/status/route.ts
git commit -m "feat: add pipeline status API endpoint"
```

---

## Task 2 — Pipeline context, types, and orchestration logic

**Files:**
- Create: `app/(dashboard)/workspaces/[workspaceId]/pipeline-context.tsx`

This file contains: type definitions, the `PipelineContext`, the `PipelineProvider` component (which owns all pipeline state and logic), and the `usePipelineContext` consumer hook.

- [ ] **Step 1: Create the file**

```bash
touch "app/(dashboard)/workspaces/[workspaceId]/pipeline-context.tsx"
```

- [ ] **Step 2: Write types and context shell**

```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useJob } from "./workspace-jobs-context";
import type { PipelineStatusResponse, PipelineStepKey } from "@/app/api/workspaces/[workspaceId]/pipeline/status/route";

export type { PipelineStepKey };

export interface PipelineStep {
  key: PipelineStepKey;
  label: string;
  status: "pending" | "skipped" | "running" | "done" | "failed";
  reason?: string;
}

export interface PipelineContextValue {
  // State
  idle: boolean;
  checking: boolean;
  running: boolean;
  done: boolean;
  failed: boolean;
  steps: PipelineStep[];
  currentStep: PipelineStepKey | null;
  errorMessage: string | undefined;
  statusError: boolean;
  canRun: boolean;
  blockedReason: string | null;
  dismissed: boolean;
  // Actions
  runPipeline: () => void;
  dismiss: () => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function usePipelineContext(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipelineContext must be used inside PipelineProvider");
  return ctx;
}
```

- [ ] **Step 3: Write the PipelineProvider with orchestration logic**

Append to the same file, after the `usePipelineContext` export:

```typescript
export function PipelineProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // SSE job hooks — must be called unconditionally at the top
  const synthesizeJob = useJob("synthesize");
  const opportunitiesJob = useJob("opportunities");
  const ticketsJob = useJob("tickets");

  // Pipeline state
  const [idle, setIdle] = useState(true);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [currentStep, setCurrentStep] = useState<PipelineStepKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusError, setStatusError] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem(`sentinel-pipeline-dismissed-${workspaceId}`) ===
      "true"
    );
  });

  const abortRef = useRef(false);

  const dismiss = useCallback(() => {
    localStorage.setItem(
      `sentinel-pipeline-dismissed-${workspaceId}`,
      "true"
    );
    setDismissed(true);
  }, [workspaceId]);

  // Auto-dismiss 4 seconds after completion
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(dismiss, 4000);
    return () => clearTimeout(id);
  }, [done, dismiss]);

  // Wrap an SSE startJob call in a Promise so it can be awaited
  const runSSEStep = useCallback(
    (
      startJobFn: (
        url: string,
        onDone: (r: Record<string, unknown>) => void,
        onError: (m: string) => void,
        opts?: { body?: string }
      ) => void,
      url: string,
      body?: Record<string, unknown>
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        startJobFn(
          url,
          () => resolve(),
          (msg) => reject(new Error(msg)),
          body ? { body: JSON.stringify(body) } : undefined
        );
      }),
    []
  );

  const updateStep = useCallback(
    (key: PipelineStepKey, status: PipelineStep["status"]) => {
      setSteps((prev) =>
        prev.map((s) => (s.key === key ? { ...s, status } : s))
      );
    },
    []
  );

  const runPipeline = useCallback(async () => {
    abortRef.current = false;
    setIdle(false);
    setChecking(true);
    setFailed(false);
    setDone(false);
    setSteps([]);
    setCurrentStep(null);
    setErrorMessage(undefined);
    setStatusError(false);

    let status: PipelineStatusResponse;
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pipeline/status`
      );
      if (!res.ok) throw new Error("Status check failed");
      status = await res.json();
    } catch {
      setStatusError(true);
      setChecking(false);
      setIdle(true);
      return;
    }

    setCanRun(status.canRun);
    setBlockedReason(status.blockedReason);

    if (!status.canRun) {
      setChecking(false);
      setIdle(true);
      return;
    }

    // Initialise all steps in state
    setSteps(
      status.steps.map((s) => ({
        key: s.key,
        label: s.label,
        status: s.needsRun ? "pending" : "skipped",
        reason: s.reason,
      }))
    );
    setChecking(false);
    setRunning(true);

    let topOpportunityId = status.topOpportunityId;
    let latestPrdId = status.latestPrdId;

    try {
      for (const step of status.steps) {
        if (abortRef.current) break;
        if (!step.needsRun) continue;

        setCurrentStep(step.key);
        updateStep(step.key, "running");

        let stepResult: "done" | "skipped" = "done";

        switch (step.key) {
          case "synthesize":
            await runSSEStep(
              synthesizeJob.startJob,
              `/api/workspaces/${workspaceId}/synthesize`
            );
            break;

          case "opportunities":
            await runSSEStep(
              opportunitiesJob.startJob,
              `/api/workspaces/${workspaceId}/opportunities/generate`
            );
            // Fetch fresh top opportunity after this SSE step completes
            try {
              const oppRes = await fetch(
                `/api/workspaces/${workspaceId}/opportunities`
              );
              if (oppRes.ok) {
                const oppData = await oppRes.json();
                topOpportunityId = oppData.data?.[0]?.id ?? null;
              }
            } catch { /* topOpportunityId stays null */ }
            break;

          case "prd":
            if (!topOpportunityId) {
              stepResult = "skipped";
              break;
            }
            {
              const prdRes = await fetch(
                `/api/workspaces/${workspaceId}/prds/generate`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ opportunityId: topOpportunityId }),
                }
              );
              if (!prdRes.ok) {
                const err = await prdRes.json().catch(() => ({}));
                throw new Error(
                  (err as { error?: { message?: string } }).error?.message ??
                    "PRD generation failed"
                );
              }
              // Fetch the newly created PRD's id for the tickets step
              try {
                const prdListRes = await fetch(
                  `/api/workspaces/${workspaceId}/prds`
                );
                if (prdListRes.ok) {
                  const prdData = await prdListRes.json();
                  latestPrdId = prdData.data?.[0]?.id ?? null;
                }
              } catch { /* latestPrdId stays null */ }
            }
            break;

          case "tickets":
            await runSSEStep(
              ticketsJob.startJob,
              `/api/workspaces/${workspaceId}/tickets/generate`,
              latestPrdId ? { prdId: latestPrdId } : undefined
            );
            break;

          case "summary":
            {
              const sumRes = await fetch(
                `/api/workspaces/${workspaceId}/reports/executive-summary`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    audience: "Leadership",
                    timeframe: "Last 30 days",
                  }),
                }
              );
              if (!sumRes.ok) throw new Error("Summary generation failed");
            }
            break;
        }

        updateStep(step.key, stepResult);
      }

      setRunning(false);
      setDone(true);
      setCurrentStep(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setRunning(false);
      setFailed(true);
      setCurrentStep(null);
      setErrorMessage(msg);
      // Mark the step that was running as failed
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s))
      );
    }
  }, [
    workspaceId,
    runSSEStep,
    updateStep,
    synthesizeJob.startJob,
    opportunitiesJob.startJob,
    ticketsJob.startJob,
    router,
  ]);

  return (
    <PipelineContext.Provider
      value={{
        idle,
        checking,
        running,
        done,
        failed,
        steps,
        currentStep,
        errorMessage,
        statusError,
        canRun,
        blockedReason,
        dismissed,
        runPipeline,
        dismiss,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "pipeline-context" | head -20
```

Expected: no errors for this file.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/pipeline-context.tsx"
git commit -m "feat: add PipelineProvider with pipeline orchestration logic"
```

---

## Task 3 — PipelineBanner component

**Files:**
- Create: `app/(dashboard)/workspaces/[workspaceId]/pipeline-banner.tsx`

- [ ] **Step 1: Write the component**

```typescript
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
import type { PipelineStepKey } from "./pipeline-context";

const STEP_ICONS: Record<PipelineStepKey, React.ElementType> = {
  synthesize: Zap,
  opportunities: Zap,
  prd: Zap,
  tickets: Zap,
  summary: Zap,
};

function StepIcon({
  status,
}: {
  status: "pending" | "skipped" | "running" | "done" | "failed";
}) {
  if (status === "running")
    return <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />;
  if (status === "done")
    return <Check className="h-3 w-3 text-emerald-400 shrink-0" />;
  if (status === "skipped")
    return <Minus className="h-3 w-3 text-muted-foreground/40 shrink-0" />;
  if (status === "failed")
    return <X className="h-3 w-3 text-red-400 shrink-0" />;
  return <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />;
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
    canRun,
    blockedReason,
    dismissed,
    runPipeline,
    dismiss,
  } = usePipelineContext();

  // Pre-fetch status on mount so we can show the step list
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
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/pipeline/status`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setPreviewCanRun(data.canRun);
        setPreviewBlockedReason(data.blockedReason);
        setPreviewSteps(data.steps.filter((s: { needsRun: boolean }) => s.needsRun));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setPreviewChecking(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Don't render if already dismissed
  if (dismissed) return null;

  // Don't render if status says nothing to do
  if (!previewChecking && previewCanRun === false && previewBlockedReason === "Everything is up to date") {
    return null;
  }

  // Fade-out on completion (dismissed by context effect after 4s)
  const isFading = done;

  return (
    <div
      className={cn(
        "bg-card border border-indigo-500/25 rounded-xl overflow-hidden shadow-sm transition-opacity duration-700",
        isFading ? "opacity-0" : "opacity-100"
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
                  <AlertCircle className="h-3 w-3" /> Couldn't check status
                </p>
              ) : previewCanRun === false && previewBlockedReason === "Upload documents first" ? (
                <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 border-indigo-500/30">
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
                aria-label="Dismiss"
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

      {/* Running state */}
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
                  step.status === "running" &&
                    "text-foreground animate-pulse",
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
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "pipeline-banner" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/pipeline-banner.tsx"
git commit -m "feat: add PipelineBanner component"
```

---

## Task 4 — Wire up workspace shell

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/workspace-shell.tsx`

`PipelineProvider` must sit inside `WorkspaceJobsProvider` (it calls `useJob` internally) and wrap `WorkspaceProvider`.

- [ ] **Step 1: Add the import**

In `workspace-shell.tsx`, add after the existing imports:

```typescript
import { PipelineProvider } from "./pipeline-context";
```

- [ ] **Step 2: Wrap the interior with PipelineProvider**

Find this block (around line 60–91):

```typescript
  return (
    <WorkspaceJobsProvider>
    <WorkspaceProvider>
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <WorkspaceNav workspaceId={workspaceId} />
```

Replace it with:

```typescript
  return (
    <WorkspaceJobsProvider>
    <PipelineProvider workspaceId={workspaceId}>
    <WorkspaceProvider>
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <WorkspaceNav workspaceId={workspaceId} />
```

And close the `PipelineProvider` after `</WorkspaceProvider>`:

```typescript
    </WorkspaceProvider>
    </PipelineProvider>
    </WorkspaceJobsProvider>
```

- [ ] **Step 3: Verify the shell compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "workspace-shell" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/workspace-shell.tsx"
git commit -m "feat: add PipelineProvider to workspace shell"
```

---

## Task 5 — Add banner to overview page

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/page.tsx`

The page is a Server Component. `PipelineBanner` is a Client Component — this is a valid import pattern in Next.js App Router.

- [ ] **Step 1: Add the import**

In `page.tsx`, add after the existing imports:

```typescript
import { PipelineBanner } from "./pipeline-banner";
```

- [ ] **Step 2: Insert the banner above the stats row**

Find the stats row comment and block (around line 176):

```typescript
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
```

Insert the `PipelineBanner` immediately before it:

```typescript
        {/* Autonomous pipeline banner */}
        <PipelineBanner workspaceId={workspaceId} />

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
```

- [ ] **Step 3: Remove or keep existing `suggestion` banner**

The existing "Sentinel Suggests" banner is a server-rendered single-action nudge. The pipeline banner is a richer client-side orchestrator. Keep both — they serve different purposes. No change needed.

- [ ] **Step 4: Verify the page compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "workspaces.*page" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/page.tsx"
git commit -m "feat: render PipelineBanner on workspace overview"
```

---

## Task 6 — Nav pulsing dot indicators

**Files:**
- Modify: `components/nav/workspace-nav.tsx`

The nav already has a badge pattern for the Inbox count. We'll add a pulsing indigo dot next to tab labels when the pipeline step for that tab is running.

- [ ] **Step 1: Add the import**

In `workspace-nav.tsx`, add after the existing imports:

```typescript
import { usePipelineContext } from "@/app/(dashboard)/workspaces/[workspaceId]/pipeline-context";
import type { PipelineStepKey } from "@/app/(dashboard)/workspaces/[workspaceId]/pipeline-context";
```

- [ ] **Step 2: Add pipeline step key mapping to the links array**

Update the `links` array to include an optional `pipelineKey` on each relevant link. Find the existing `links` definition (around line 57) and replace it:

```typescript
  const links: Array<{
    href: string;
    activeHref: string;
    label: string;
    icon: React.ElementType;
    exact?: boolean;
    badge?: number;
    pipelineKey?: PipelineStepKey;
  }> = [
    { href: base,                         activeHref: base,                         label: "Overview",        icon: BookOpen,          exact: true },
    { href: `${base}/documents`,          activeHref: `${base}/documents`,          label: "Documents",       icon: FileText },
    { href: `${base}/insights`,           activeHref: `${base}/insights`,           label: "Insights",        icon: Lightbulb,         pipelineKey: "synthesize" },
    { href: `${base}/opportunities`,      activeHref: `${base}/opportunities`,      label: "Opportunities",   icon: Target,            pipelineKey: "opportunities" },
    { href: prdHref,                      activeHref: `${base}/prd`,                label: "PRDs",            icon: FileText,          pipelineKey: "prd" },
    { href: `${base}/tickets`,            activeHref: `${base}/tickets`,            label: "Tickets",         icon: Kanban,            pipelineKey: "tickets" },
    { href: `${base}/search`,             activeHref: `${base}/search`,             label: "Search",          icon: Search },
    { href: `${base}/reports`,            activeHref: `${base}/reports`,            label: "Reports",         icon: BarChart2,         pipelineKey: "summary" },
    { href: `${base}/interview-guide`,    activeHref: `${base}/interview-guide`,    label: "Interview Guide", icon: MessageSquarePlus },
    { href: `${base}/inbox`,              activeHref: `${base}/inbox`,              label: "Inbox",           icon: Inbox,             badge: pendingCount },
    { href: `${base}/integrations`,       activeHref: `${base}/integrations`,       label: "Integrations",    icon: Plug },
  ];
```

- [ ] **Step 3: Consume pipeline context inside the nav component**

Add this line inside `WorkspaceNav`, after the `pendingCount` state declaration (around line 28):

```typescript
  const pipeline = usePipelineContext();
```

- [ ] **Step 4: Render the pulsing dot**

Find the tab label rendering inside the `links.map` (around line 86). Update the `Link` body to include the dot:

```typescript
            <Icon className="h-3 w-3" />
            {label}
            {badge != null && badge > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-none">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {pipelineKey && pipeline.currentStep === pipelineKey && (
              <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            )}
```

The destructured variable `pipelineKey` needs to be added to the destructuring in the `links.map`. Find:

```typescript
      {links.map(({ href, activeHref, label, icon: Icon, exact, badge }) => {
```

Replace with:

```typescript
      {links.map(({ href, activeHref, label, icon: Icon, exact, badge, pipelineKey }) => {
```

- [ ] **Step 5: Verify the nav compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "workspace-nav" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/nav/workspace-nav.tsx
git commit -m "feat: add pulsing pipeline step indicators to workspace nav"
```

---

## Task 7 — End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Open a workspace that has at least one completed document**

Navigate to `http://localhost:3000/workspaces/<id>`. Verify:
- The pipeline banner appears above the stats row
- The banner shows a list of steps that need to run (from the status pre-fetch)
- The "Run Sentinel" button is enabled

- [ ] **Step 3: Click "Run Sentinel" and watch the progress**

Verify:
- The banner expands to show the running step list
- Each step row shows the correct icon (spinner → checkmark → dash for skipped)
- The nav tab for the currently running step shows a pulsing dot
- The dot disappears when the step finishes

- [ ] **Step 4: Verify completion**

After all steps complete:
- The banner shows the green completion state
- After 4 seconds it fades and disappears
- The page data refreshes (stats row shows updated counts)
- Opening the workspace again: banner does not reappear (localStorage dismissal key set)

- [ ] **Step 5: Test a new workspace (no documents)**

Navigate to a workspace with no completed documents. Verify:
- The banner shows the blocked state with "Upload documents" button
- The "Run Sentinel" button is not shown

- [ ] **Step 6: Test a fully up-to-date workspace**

On a workspace that has already run the full pipeline with no new documents:
- The banner should not appear (canRun=false, blockedReason="Everything is up to date")

- [ ] **Step 7: Run a full type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Final commit**

```bash
git add -p
git commit -m "feat: autonomous pipeline smoke test verified"
```

---

## Appendix — Key invariants

| Invariant | Where enforced |
|-----------|---------------|
| `PipelineProvider` must be inside `WorkspaceJobsProvider` | Provider nesting in `workspace-shell.tsx` |
| `usePipelineContext` throws outside provider | Guard in `usePipelineContext()` |
| `usePipeline` calls `useJob` unconditionally at hook top | All three `useJob` calls before any branching logic |
| PRD step skipped if no opportunity ID after opportunities run | `if (!topOpportunityId) { stepResult = "skipped"; break; }` in `pipeline-context.tsx` |
| Dismissal key is workspace-scoped | `sentinel-pipeline-dismissed-${workspaceId}` in localStorage |
| Status re-checked on every `runPipeline` call | First action inside `runPipeline` is a fresh `fetch` to the status endpoint |
