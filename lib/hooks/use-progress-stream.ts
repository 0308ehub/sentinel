"use client";

import { useState, useCallback } from "react";
import type { ProgressStep } from "@/components/ui/progress-stream";

interface DoneEvent {
  [key: string]: unknown;
}

export function useProgressStream(url: string) {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState(false);

  const addStep = (text: string) =>
    setSteps((prev) => {
      const updated = prev.map((s, i) =>
        i === prev.length - 1 ? { ...s, done: true } : s
      );
      return [...updated, { text, done: false }];
    });

  const run = useCallback(async (): Promise<DoneEvent | null> => {
    setRunning(true);
    setSteps([]);

    return new Promise((resolve) => {
      fetch(url, { method: "POST" })
        .then(async (res) => {
          if (!res.ok || !res.body) {
            const data = await res.json().catch(() => ({}));
            resolve(null);
            throw new Error(data?.error?.message ?? "Request failed");
          }

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
                const event = JSON.parse(line.slice(6));
                if (event.type === "step") {
                  addStep(event.step);
                } else if (event.type === "done") {
                  setSteps((prev) => prev.map((s) => ({ ...s, done: true })));
                  resolve(event);
                } else if (event.type === "error") {
                  throw new Error(event.message);
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
          resolve(null);
        })
        .catch((err) => {
          setSteps((prev) =>
            prev.map((s, i) => (i === prev.length - 1 ? { ...s, done: true } : s))
          );
          resolve(null);
          throw err;
        })
        .finally(() => setRunning(false));
    });
  }, [url]);

  const reset = useCallback(() => {
    setSteps([]);
    setRunning(false);
  }, []);

  return { steps, running, run, reset };
}
