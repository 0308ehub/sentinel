"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface GitHubImportRepo {
  fullName: string;
  private: boolean;
  description: string;
  account: string;
  updatedAt: string;
}

export interface GitHubImportNamespace {
  account: string;
  installationId?: number;
}

export function GitHubImportList({
  repos,
  namespaces,
  selected,
  busy = false,
  onImport,
  onAdjust,
}: {
  repos: GitHubImportRepo[];
  namespaces: GitHubImportNamespace[];
  selected: string;
  busy?: boolean;
  onImport: (repo: string) => void;
  onAdjust?: () => void;
}) {
  const selectedOwner = selected.split("/", 1)[0];
  const [namespace, setNamespace] = useState("");
  const [search, setSearch] = useState("");
  const selectedNamespace = namespaces.find((item) => item.account.toLowerCase() === selectedOwner.toLowerCase())?.account;
  const activeNamespace = namespaces.some((item) => item.account === namespace)
    ? namespace
    : selectedNamespace || namespaces[0]?.account || "";

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return repos.filter((repo) =>
      repo.account.toLowerCase() === activeNamespace.toLowerCase()
      && (!query || repo.fullName.split("/").at(-1)?.toLowerCase().includes(query)),
    );
  }, [activeNamespace, repos, search]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="github-namespace">GitHub account</Label>
          <select
            id="github-namespace"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={activeNamespace}
            onChange={(event) => setNamespace(event.target.value)}
          >
            {namespaces.map((item) => <option key={`${item.account}-${item.installationId ?? "token"}`} value={item.account}>{item.account}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="github-repo-search">Search repositories</Label>
          <Input id="github-repo-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" />
        </div>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {visible.length ? visible.map((repo) => {
          const name = repo.fullName.split("/").at(-1) || repo.fullName;
          const isSelected = repo.fullName === selected;
          return (
            <li key={repo.fullName} className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{name}</span>
                  {repo.private && <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Private</span>}
                </div>
                <p className="text-xs text-muted-foreground">Updated {relativeTime(repo.updatedAt)}</p>
              </div>
              <Button type="button" size="sm" variant={isSelected ? "outline" : "default"} disabled={busy || isSelected} onClick={() => onImport(repo.fullName)}>
                {isSelected ? "Selected" : "Import"}
              </Button>
            </li>
          );
        }) : (
          <li className="px-3 py-4 text-sm text-muted-foreground">No repositories found for this account.</li>
        )}
      </ul>
      {onAdjust && (
        <button type="button" className="text-sm text-brand hover:underline focus-visible:outline focus-visible:outline-2" onClick={onAdjust}>
          Missing a repository? Adjust GitHub App permissions →
        </button>
      )}
    </div>
  );
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed)) return "recently";
  const minutes = Math.max(1, Math.round(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
