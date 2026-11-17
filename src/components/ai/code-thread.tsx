"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Square } from "lucide-react";
import { AnswerText } from "@/components/ai/chat-pane";
import type { CoderItem, CoderView } from "@/lib/coder/view";
import { cn } from "@/lib/utils";

interface PullResult { url: string; number: number }

export function CodeThread({ sessionId, repo, justSent }: { sessionId?: string; repo: string | null; justSent: boolean }) {
  const [view, setView] = useState<CoderView | null>(null);
  const [error, setError] = useState("");
  const [pull, setPull] = useState<PullResult | null>(null);
  const inFlight = useRef(false);
  const status = view?.status;
  const stopReason = view?.stopReason;

  const refresh = useCallback(async () => {
    if (!sessionId || inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/coder/sessions/${sessionId}`, { cache: "no-store" });
      const body = (await response.json()) as CoderView & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load the coding session.");
      setView(body);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the coding session.");
    } finally {
      inFlight.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    if (!sessionId) return;
    const delay = stopReason === "requires_action" ? 10_000 : 2_500;
    const active = justSent || !status || status === "running" || status === "rescheduling" || stopReason === "requires_action";
    if (!active) return () => window.clearTimeout(initial);
    const timer = window.setInterval(() => void refresh(), delay);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [justSent, refresh, sessionId, status, stopReason]);

  async function action(path: string, body?: object) {
    if (!sessionId) return;
    const response = await fetch(`/api/coder/sessions/${sessionId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json()) as PullResult & { error?: string };
    if (!response.ok) setError(result.error || "The action failed.");
    else if (path === "pull") setPull(result);
    else void refresh();
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-3 text-xs text-muted-foreground">Working on {repo || "your repository"}</div>
      {view ? <CodeItems items={view.items} /> : sessionId ? <Loading /> : null}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {view?.pendingApproval && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Kismet wants to: {view.pendingApproval.summary}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void action("confirm", { toolUseId: view.pendingApproval!.toolUseId, allow: true })} className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">Allow</button>
            <button type="button" onClick={() => void action("confirm", { toolUseId: view.pendingApproval!.toolUseId, allow: false })} className="rounded-md border border-border px-3 py-1.5 text-xs">Deny</button>
          </div>
        </div>
      )}
      {view && <StatusLine view={view} />}
      <div className="flex flex-wrap items-center gap-2">
        {view && (view.status === "running" || view.status === "rescheduling") && (
          <button type="button" onClick={() => void action("interrupt")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs">
            <Square className="h-3 w-3" /> Stop
          </button>
        )}
        {view?.branch && !pull && (
          <button type="button" onClick={() => void action("pull")} className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">Open pull request</button>
        )}
        {pull && <a href={pull.url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">View pull request #{pull.number}</a>}
      </div>
    </div>
  );
}

function CodeItems({ items }: { items: CoderItem[] }) {
  const output = [];
  for (let index = 0; index < items.length;) {
    if (items[index].kind !== "step") {
      output.push(<CodeItem key={index} item={items[index]} />);
      index += 1;
      continue;
    }
    const start = index;
    while (index < items.length && items[index].kind === "step") index += 1;
    const steps = items.slice(start, index);
    output.push(steps.length > 6 ? (
      <details key={start} className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{steps.length} steps</summary>
        <div className="mt-2 space-y-1">{steps.map((item, offset) => <CodeItem key={offset} item={item} />)}</div>
      </details>
    ) : <div key={start} className="space-y-1">{steps.map((item, offset) => <CodeItem key={offset} item={item} />)}</div>);
  }
  return <div className="space-y-5">{output}</div>;
}

function CodeItem({ item }: { item: CoderItem }) {
  if (item.kind === "user") return <div className="flex justify-end"><p className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm">{item.text}</p></div>;
  if (item.kind === "agent") return <div className="whitespace-pre-wrap text-sm leading-relaxed"><AnswerText text={item.text} /></div>;
  if (item.kind === "error") return <p className="text-sm text-destructive">{item.text}</p>;
  return <p className={cn("text-xs text-muted-foreground", item.isError && "text-destructive")}>{item.summary}</p>;
}

function StatusLine({ view }: { view: CoderView }) {
  let label = view.status === "terminated" ? "Stopped" : "Done";
  if (view.status === "running" || view.status === "rescheduling") label = "Working…";
  else if (view.stopReason === "requires_action") label = "Waiting for you";
  else if (view.stopReason === "budget_reached") label = "Paused: spending cap reached";
  else if (view.stopReason === "end_turn") label = `Done · $${(Number(view.costCents) / 100).toFixed(2)}`;
  return <p aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">{(view.status === "running" || view.status === "rescheduling") && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{label}</p>;
}

function Loading() {
  return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Starting Code mode…</p>;
}
