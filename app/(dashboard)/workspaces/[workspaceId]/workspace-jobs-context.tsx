"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ProgressStep } from "@/components/ui/progress-stream";

export interface StreamingPainPoint {
  title: string;
  description: string;
  severity: number;
  urgency: number;
  frequency: number;
  affectedSegments: string[];
}

interface JobState {
  running: boolean;
  steps: ProgressStep[];
  streamingPainPoints: StreamingPainPoint[];
}

interface JobsContextValue {
  getJob: (key: string) => JobState;
  startJob: (
    key: string,
    url: string,
    onDone: (result: Record<string, unknown>) => void,
    onError: (msg: string) => void
  ) => void;
  cancelJob: (key: string) => void;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function WorkspaceJobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  // Track abort controllers so we can cancel if needed
  const controllers = useRef<Record<string, AbortController>>({});

  const setJob = useCallback((key: string, patch: Partial<JobState>) => {
    setJobs((prev) => ({
      ...prev,
      [key]: { ...{ running: false, steps: [], streamingPainPoints: [] }, ...prev[key], ...patch },
    }));
  }, []);

  const addStep = useCallback((key: string, text: string) => {
    setJobs((prev) => {
      const current = prev[key] ?? { running: true, steps: [] };
      // Mark the last step as done, add the new one as active
      const updated = current.steps.map((s, i) =>
        i === current.steps.length - 1 ? { ...s, done: true } : s
      );
      return {
        ...prev,
        [key]: { ...current, steps: [...updated, { text, done: false }] },
      };
    });
  }, []);

  const startJob = useCallback(
    (
      key: string,
      url: string,
      onDone: (result: Record<string, unknown>) => void,
      onError: (msg: string) => void
    ) => {
      // Cancel any previous run for this key
      controllers.current[key]?.abort();
      const ctrl = new AbortController();
      controllers.current[key] = ctrl;

      setJob(key, { running: true, steps: [], streamingPainPoints: [] });

      (async () => {
        try {
          const res = await fetch(url, { method: "POST", signal: ctrl.signal });
          if (!res.ok || !res.body) throw new Error("Request failed");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (event.type === "step" && typeof event.step === "string") {
                  addStep(key, event.step);
                } else if (event.type === "pain_point" && event.data) {
                  setJobs((prev) => {
                    const current = prev[key] ?? { running: true, steps: [], streamingPainPoints: [] };
                    return { ...prev, [key]: { ...current, streamingPainPoints: [...current.streamingPainPoints, event.data as StreamingPainPoint] } };
                  });
                } else if (event.type === "done") {
                  setJobs((prev) => ({
                    ...prev,
                    [key]: {
                      running: false,
                      steps: (prev[key]?.steps ?? []).map((s) => ({ ...s, done: true })),
                      streamingPainPoints: prev[key]?.streamingPainPoints ?? [],
                    },
                  }));
                  onDone(event);
                  // Auto-clear the progress list after 3 s so it doesn't linger
                  setTimeout(() => setJob(key, { steps: [], streamingPainPoints: [] }), 3000);
                } else if (event.type === "error") {
                  throw new Error(typeof event.message === "string" ? event.message : "Operation failed");
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setJob(key, { running: false });
          onError(err instanceof Error ? err.message : String(err));
        }
      })();
    },
    [setJob, addStep]
  );

  const cancelJob = useCallback(
    (key: string) => {
      controllers.current[key]?.abort();
      delete controllers.current[key];
      setJob(key, { running: false, steps: [], streamingPainPoints: [] });
    },
    [setJob]
  );

  const getJob = useCallback(
    (key: string): JobState => jobs[key] ?? { running: false, steps: [], streamingPainPoints: [] },
    [jobs]
  );

  return (
    <JobsContext.Provider value={{ getJob, startJob, cancelJob }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJob(key: string) {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJob must be used inside WorkspaceJobsProvider");
  return {
    ...ctx.getJob(key),
    startJob: (
      url: string,
      onDone: (result: Record<string, unknown>) => void,
      onError: (msg: string) => void
    ) => ctx.startJob(key, url, onDone, onError),
    cancelJob: () => ctx.cancelJob(key),
  };
}
