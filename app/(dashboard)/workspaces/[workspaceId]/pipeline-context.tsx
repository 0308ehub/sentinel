"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useJob } from "./workspace-jobs-context";
import type { PipelineStatusResponse, PipelineStepKey } from "./pipeline-types";

export type { PipelineStepKey };

export interface PipelineStep {
  key: PipelineStepKey;
  label: string;
  status: "pending" | "skipped" | "running" | "done" | "failed";
  reason?: string;
}

export interface PipelineContextValue {
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
  runPipeline: () => void;
  dismiss: () => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function usePipelineContext(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipelineContext must be used inside PipelineProvider");
  return ctx;
}

export function PipelineProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const synthesizeJob = useJob("synthesize");
  const opportunitiesJob = useJob("opportunities");
  const ticketsJob = useJob("tickets");

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
      localStorage.getItem(`sentinel-pipeline-dismissed-${workspaceId}`) === "true"
    );
  });

  const dismiss = useCallback(() => {
    localStorage.setItem(`sentinel-pipeline-dismissed-${workspaceId}`, "true");
    setDismissed(true);
  }, [workspaceId]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(dismiss, 4000);
    return () => clearTimeout(id);
  }, [done, dismiss]);

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
      const res = await fetch(`/api/workspaces/${workspaceId}/pipeline/status`);
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
            try {
              const oppRes = await fetch(`/api/workspaces/${workspaceId}/opportunities`);
              if (oppRes.ok) {
                const oppData = await oppRes.json();
                topOpportunityId = oppData.data?.[0]?.id ?? null;
              }
            } catch { /* topOpportunityId stays as-is */ }
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
              try {
                const prdListRes = await fetch(`/api/workspaces/${workspaceId}/prds`);
                if (prdListRes.ok) {
                  const prdData = await prdListRes.json();
                  latestPrdId = prdData.data?.[0]?.id ?? null;
                }
              } catch { /* latestPrdId stays as-is */ }
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
