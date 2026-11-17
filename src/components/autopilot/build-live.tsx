"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnswerText } from "@/components/ai/chat-pane";
import type { CoderItem, CoderView } from "@/lib/coder/view";
import { cn } from "@/lib/utils";

/** Polls the coding agent and shows its steps while it writes an experiment. */
export function BuildLive({ experimentId }: { experimentId: string }) {
  const [view, setView] = useState<CoderView | null>(null);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const status = view?.status;

  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/autopilot/experiments/${experimentId}/session`, { cache: "no-store" });
      const body = (await response.json()) as CoderView & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load the coding session.");
      setView(body);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the coding session.");
    } finally {
      inFlight.current = false;
    }
  }, [experimentId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    if (status && status !== "running" && status !== "rescheduling") return () => window.clearTimeout(initial);
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh, status]);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [view?.items.length]);

  const items = (view?.items ?? []).filter((item) => item.kind !== "user");
  const working = !view || view.status === "running" || view.status === "rescheduling";

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <div ref={scroller} className="max-h-72 space-y-2 overflow-y-auto p-3">
        {items.length === 0 && !error && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting the coding agent…
          </p>
        )}
        {items.map((item, index) => (
          <BuildItem key={index} item={item} />
        ))}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <p className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {working ? "Working…" : "The coding agent stopped."}
      </p>
    </div>
  );
}

function BuildItem({ item }: { item: CoderItem }) {
  if (item.kind === "agent") return <div className="whitespace-pre-wrap text-sm leading-relaxed"><AnswerText text={item.text} /></div>;
  if (item.kind === "error") return <p className="text-xs text-destructive">{item.text}</p>;
  if (item.kind === "user") return null;
  return <p className={cn("text-xs text-muted-foreground", item.isError && "text-destructive")}>{item.summary}</p>;
}
