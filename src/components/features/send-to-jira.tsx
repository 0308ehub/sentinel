"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { graphStore } from "@/lib/graph/graph-store";

export function SendToJira({
  featureId,
  title,
  description,
  compact = false,
}: {
  featureId: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const jiraKey = graphStore.getState().nodes.find((node) => node.id === featureId)?.metadata.jiraKey;
  const existing = typeof jiraKey === "string" ? jiraKey : "";

  async function send() {
    setPending(true);
    setNote("");
    try {
      const res = await fetch("/api/jira/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const body = (await res.json()) as { key?: string; url?: string; sprint?: string; hint?: string; error?: string };
      if (!res.ok || !body.key || !body.url) {
        setNote(body.hint || body.error || "Jira did not create the issue.");
        return;
      }
      graphStore.getState().noteJira(featureId, { key: body.key, url: body.url, sprint: body.sprint });
      setNote(body.sprint ? `${body.key} is on ${body.sprint}.` : `${body.key} is in the backlog. No active sprint was open.`);
    } catch {
      setNote("Jira could not be reached.");
    } finally {
      setPending(false);
    }
  }

  if (compact) {
    if (existing) return null;
    return (
      <span className="inline-flex flex-col items-start">
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="rounded-full border border-[#e6e8ec] px-1.5 py-0.5 text-[10px] text-[#626970] hover:bg-[#f4f5f7] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Jira"}
        </button>
        {note && <span className="mt-1 text-[10px] text-muted-foreground">{note}</span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={send} disabled={pending || Boolean(existing)}>
        {existing ? existing : pending ? "Sending…" : "Add to Jira"}
      </Button>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  );
}
