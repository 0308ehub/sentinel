"use client";

import { useEffect, useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";

interface RepoOption {
  fullName: string;
  description: string;
}

export function GitHubView() {
  const [login, setLogin] = useState("");
  const [hint, setHint] = useState("");
  const [repos, setRepos] = useState<RepoOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/github/status", { cache: "no-store" })
      .then((res) => res.json())
      .then(async (body: { connected?: boolean; login?: string; hint?: string }) => {
        if (cancelled) return;
        if (!body.connected) {
          setHint(body.hint || "GitHub is not connected.");
          return;
        }
        setLogin(body.login || "");
        const reposRes = await fetch("/api/github/repos", { cache: "no-store" });
        const reposBody = (await reposRes.json()) as { repos?: RepoOption[]; hint?: string };
        if (cancelled) return;
        if (!reposRes.ok) setHint(reposBody.hint || "Could not list repositories.");
        else setRepos(reposBody.repos ?? []);
      })
      .catch(() => {
        if (!cancelled) setHint("Could not reach GitHub.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsShell
      title="GitHub"
      description="Kismet opens an experiment pull request on a repository this token can push to. A key saved in the browser does not do that."
    >
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {login ? (
        <>
          <p className="text-sm">Connected as {login}.</p>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {(repos ?? []).length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No repositories this token can push to.</li>
            ) : (
              repos?.map((repo) => (
                <li key={repo.fullName} className="px-3 py-2 text-sm">
                  <p>{repo.fullName}</p>
                  {repo.description ? <p className="text-xs text-muted-foreground">{repo.description}</p> : null}
                </li>
              ))
            )}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Fork https://github.com/nextjs/saas-starter into this account, then open an experiment and choose that fork. The pull request edits one existing screen and leaves the change behind a flag.
          </p>
        </>
      ) : null}
    </SettingsShell>
  );
}
