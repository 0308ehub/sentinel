"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CodingAgentSection } from "@/components/settings/coding-agent-section";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openGitHubInstall, type GitHubInstallStatus } from "@/components/settings/github-connect";
import {
  GitHubImportList,
  type GitHubImportNamespace,
  type GitHubImportRepo,
} from "@/components/settings/github-import-list";

export function GitHubView() {
  const searchParams = useSearchParams();
  const [appAvailable, setAppAvailable] = useState(false);
  const [account, setAccount] = useState("");
  const [login, setLogin] = useState("");
  const [hint, setHint] = useState("");
  const [repos, setRepos] = useState<GitHubImportRepo[] | null>(null);
  const [namespaces, setNamespaces] = useState<GitHubImportNamespace[]>([]);
  const [token, setToken] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState("");
  const [via, setVia] = useState<"app" | "token" | "">("");
  const [waiting, setWaiting] = useState(false);
  const [popupCleanup, setPopupCleanup] = useState<(() => void) | null>(null);

  useEffect(() => () => popupCleanup?.(), [popupCleanup]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/github/status", { cache: "no-store" }),
      fetch("/api/github/app/available", { cache: "no-store" }),
    ])
      .then(async ([statusRes, availableRes]) => {
        const body = (await statusRes.json()) as {
          connected?: boolean;
          login?: string;
          account?: string;
          hint?: string;
          via?: "app" | "token";
        };
        const availability = (await availableRes.json()) as { available?: boolean };
        if (cancelled) return;
        setAppAvailable(Boolean(availability.available));
        setHint("");
        if (!body.connected) {
          setAccount("");
          setLogin("");
          setVia("");
          setRepos(null);
          setHint(body.hint?.startsWith("Connect ") ? "" : body.hint || "GitHub is not connected.");
          return;
        }
        setAccount(body.account || body.login || "");
        setLogin(body.login || "");
        setVia(body.via || "token");
        const [reposRes, targetRes] = await Promise.all([
          fetch("/api/github/repos", { cache: "no-store" }),
          fetch("/api/autopilot/repo", { cache: "no-store" }),
        ]);
        const reposBody = (await reposRes.json()) as {
          repos?: GitHubImportRepo[];
          namespaces?: GitHubImportNamespace[];
          hint?: string;
        };
        const targetBody = (await targetRes.json()) as { repo?: string };
        if (!cancelled) {
          if (!reposRes.ok) setHint(reposBody.hint || "Could not list repositories.");
          else setRepos(reposBody.repos ?? []);
          setNamespaces(reposBody.namespaces ?? []);
          if (targetRes.ok && targetBody.repo) setTarget(targetBody.repo);
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

  async function chooseRepo(repo: string) {
    const previous = target;
    setTarget(repo);
    setHint("");
    const res = await fetch("/api/autopilot/repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
    });
    if (!res.ok) {
      setTarget(previous);
      setHint("Could not save the repository Kismet ships to.");
    }
  }

  function install(adjust = false) {
    popupCleanup?.();
    setWaiting(true);
    setHint("");
    const cleanup = openGitHubInstall("/settings/connectors/github", (status, error) => {
      setWaiting(false);
      setPopupCleanup(null);
      // Saving repo access on GitHub's configure page may not come back to Kismet; re-read the list anyway.
      if (adjust && error === "popup_closed") setRefresh((value) => value + 1);
      handleInstallResult(status, error);
    }, { install: adjust });
    setPopupCleanup(() => cleanup);
  }

  function handleInstallResult(status: GitHubInstallStatus, error?: string) {
    if (status === "connected") {
      setRefresh((value) => value + 1);
      return;
    }
    if (status === "pending") {
      setHint("An organization owner needs to approve Kismet");
      return;
    }
    if (error !== "popup_closed") setHint(appErrorMessage(error || "connect_failed"));
  }

  return (
    <SettingsShell
      title="GitHub"
      description={appAvailable
        ? "Kismet opens experiment pull requests in repositories you grant it access to."
        : "Kismet opens an experiment pull request on a repository this token can push to."}
    >
      {!login ? (
        <div className="max-w-lg space-y-3">
          {searchParams.get("pending") === "1" && (
            <p className="text-sm text-muted-foreground">Waiting for an organization owner to approve the install.</p>
          )}
          {searchParams.get("error") && (
            <p className="text-xs text-destructive">{appErrorMessage(searchParams.get("error")!)}</p>
          )}
          {appAvailable && (
            <Button size="sm" disabled={waiting} onClick={() => install()}>
              {waiting ? "Waiting for GitHub…" : "Install Kismet on GitHub"}
            </Button>
          )}
          {appAvailable && hint && <p role="alert" className="text-xs text-destructive">{hint}</p>}
          {appAvailable ? (
            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm">Use a personal access token instead</summary>
              <div className="mt-3 space-y-3">
                <TokenForm token={token} saving={saving} hint={hint} onChange={setToken} onConnect={() => void update("connect")} />
              </div>
            </details>
          ) : (
            <TokenForm token={token} saving={saving} hint={hint} onChange={setToken} onConnect={() => void update("connect")} />
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm">
              {via === "app" ? `Connected through the Kismet GitHub App as ${account}.` : `Connected as ${login}.`}
            </p>
            <Button
              className="ml-auto"
              variant="outline"
              size="sm"
              onClick={() => void update("disconnect")}
            >
              Disconnect
            </Button>
          </div>
          {via === "app" && (
            <a
              className="mt-2 inline-block text-xs text-[#0571d3] hover:underline"
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
            >
              Manage or remove the app on GitHub
            </a>
          )}
          {hint && <p className="mt-3 text-xs text-destructive">{hint}</p>}
          <div className="mt-4 max-w-2xl">
            <GitHubImportList
              repos={repos ?? []}
              namespaces={namespaces}
              selected={target}
              busy={saving || waiting}
              onImport={(repo) => void chooseRepo(repo)}
              onAdjust={via === "app" ? () => install(true) : undefined}
            />
            {waiting && <p className="mt-2 text-sm text-muted-foreground">Waiting for GitHub…</p>}
          </div>
          <CodingAgentSection repo={target} />
        </>
      )}
    </SettingsShell>
  );
}

function TokenForm({
  token,
  saving,
  hint,
  onChange,
  onConnect,
}: {
  token: string;
  saving: boolean;
  hint: string;
  onChange: (value: string) => void;
  onConnect: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="github-token">Personal access token</Label>
        <Input
          id="github-token"
          type="password"
          value={token}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Create a fine-grained token at{" "}
        <a className="text-[#0571d3] hover:underline" href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
          github.com/settings/tokens
        </a>{" "}
        with Contents and Pull requests read/write access.
      </p>
      {hint && <p className="text-xs text-destructive">{hint}</p>}
      <Button size="sm" disabled={saving} onClick={onConnect}>
        {saving ? "Connecting…" : "Connect"}
      </Button>
    </>
  );
}

function appErrorMessage(code: string): string {
  if (code === "state") return "The GitHub install expired or could not be verified. Please try again.";
  if (code === "not_configured") return "The Kismet GitHub App is not configured.";
  return "Kismet could not finish connecting the GitHub App. Please try again.";
}
