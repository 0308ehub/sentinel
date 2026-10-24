"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { graphStore } from "@/lib/graph/graph-store";
import type { GraphNode } from "@/types/graph";

interface RepoOption {
  fullName: string;
}

export function ShipPullRequest({ node }: { node: GraphNode }) {
  const existing = text(node.metadata.prUrl);
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [repo, setRepo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadRepos() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/github/repos", { cache: "no-store" });
      const body = (await res.json()) as { repos?: RepoOption[]; hint?: string; error?: string };
      if (!res.ok) throw new Error(body.hint || body.error || "Could not list repositories.");
      const list = body.repos ?? [];
      setRepos(list);
      setRepo(list[0]?.fullName ?? "");
      if (list.length === 0) setError("This token cannot push to any repository yet.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not list repositories.");
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    if (!repo || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/experiments/pull-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          title: node.title,
          hypothesis: node.description ?? "",
          metric: text(node.metadata.metric),
          control: text(node.metadata.control),
          treatment: text(node.metadata.treatment),
          guardrail: text(node.metadata.guardrail),
        }),
      });
      const body = (await res.json()) as { url?: string; number?: number; branch?: string; hint?: string; error?: string };
      if (!res.ok || !body.url || !body.number || !body.branch) {
        throw new Error(body.hint || body.error || "Could not open the pull request.");
      }
      graphStore.getState().notePullRequest(node.id, { url: body.url, number: body.number, repo, branch: body.branch });
      setRepos(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the pull request.");
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    return (
      <a href={existing} target="_blank" rel="noreferrer" className="text-brand hover:underline">
        Pull request{text(node.metadata.prNumber) ? ` #${text(node.metadata.prNumber)}` : ""}
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {repos === null ? (
        <Button type="button" size="sm" variant="outline" onClick={() => void loadRepos()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Open a pull request
        </Button>
      ) : (
        <>
          <select
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            aria-label="Repository"
            className="h-8 max-w-64 rounded-md border border-border bg-background px-2 text-xs"
          >
            {repos.map((item) => (
              <option key={item.fullName} value={item.fullName}>
                {item.fullName}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={() => void open()} disabled={busy || !repo}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Ship
          </Button>
        </>
      )}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
