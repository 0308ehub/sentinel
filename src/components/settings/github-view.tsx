"use client";

import { useEffect, useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RepoOption {
  fullName: string;
  description: string;
}

export function GitHubView() {
  const [login, setLogin] = useState("");
  const [hint, setHint] = useState("");
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [token, setToken] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/github/status", { cache: "no-store" })
      .then((res) => res.json())
      .then(async (body: { connected?: boolean; login?: string; hint?: string }) => {
        if (cancelled) return;
        setHint("");
        if (!body.connected) {
          setLogin("");
          setRepos(null);
          setHint(body.hint?.startsWith("Connect ") ? "" : body.hint || "GitHub is not connected.");
          return;
        }
        setLogin(body.login || "");
        const reposRes = await fetch("/api/github/repos", { cache: "no-store" });
        const reposBody = (await reposRes.json()) as { repos?: RepoOption[]; hint?: string };
        if (!cancelled) {
          if (!reposRes.ok) setHint(reposBody.hint || "Could not list repositories.");
          else setRepos(reposBody.repos ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setHint("Could not reach GitHub.");
      });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function update(action: "connect" | "disconnect") {
    setSaving(true);
    setHint("");
    const res = await fetch(`/api/github/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "connect" ? JSON.stringify({ token }) : undefined,
    });
    const body = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setHint(body.error ?? "Could not update GitHub connection.");
      return;
    }
    setToken("");
    setRefresh((value) => value + 1);
  }

  return (
    <SettingsShell
      title="GitHub"
      description="Kismet opens an experiment pull request on a repository this token can push to."
    >
      {!login ? (
        <div className="max-w-lg space-y-3">
          <div className="space-y-1">
            <Label htmlFor="github-token">Personal access token</Label>
            <Input
              id="github-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Create a fine-grained token at{" "}
            <a
              className="text-[#0571d3] hover:underline"
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
            >
              github.com/settings/tokens
            </a>{" "}
            with Contents and Pull requests read/write access.
          </p>
          {hint && <p className="text-xs text-destructive">{hint}</p>}
          <Button size="sm" disabled={saving} onClick={() => void update("connect")}>
            {saving ? "Connecting…" : "Connect"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm">Connected as {login}.</p>
            <Button
              className="ml-auto"
              variant="outline"
              size="sm"
              onClick={() => void update("disconnect")}
            >
              Disconnect
            </Button>
          </div>
          {hint && <p className="mt-3 text-xs text-destructive">{hint}</p>}
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {(repos ?? []).length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                No repositories this token can push to.
              </li>
            ) : (
              repos?.map((repo) => (
                <li key={repo.fullName} className="px-3 py-2 text-sm">
                  <p>{repo.fullName}</p>
                  {repo.description && <p className="text-xs text-muted-foreground">{repo.description}</p>}
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </SettingsShell>
  );
}
