"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JiraApiErrorBody, JiraIssue, JiraStatus } from "@/lib/jira/types";
import { formatRelativeTime } from "@/lib/utils";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) {
    const err = body as JiraApiErrorBody;
    throw new Error(err.hint ?? err.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function JiraIssuesView() {
  const [status, setStatus] = useState<JiraStatus | null>(null);
  const [issues, setIssues] = useState<JiraIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ baseUrl: "", email: "", apiToken: "", projectKey: "" });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getJson<JiraStatus>("/api/jira/status").catch(
        (reason: Error): JiraStatus => ({ connected: false, error: reason.message })
      );
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!status?.connected) return;
    let current = true;
    (async () => {
      await Promise.resolve();
      if (current) setLoading(true);
      try {
        const body = await getJson<{ issues: JiraIssue[] }>("/api/jira/issues");
        if (!current) return;
        setIssues(body.issues);
        setSyncedAt(new Date());
        setError(null);
      } catch (reason) {
        if (current) setError((reason as Error).message);
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [status?.connected, refreshKey]);

  async function connection(action: "connect" | "disconnect") {
    setConnecting(true);
    setError(null);
    const res = await fetch(`/api/jira/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "connect" ? JSON.stringify(form) : undefined,
    });
    const body = (await res.json()) as { error?: string };
    setConnecting(false);
    if (!res.ok) {
      setError(body.error ?? "Could not update Jira connection.");
      return;
    }
    setForm({ baseUrl: "", email: "", apiToken: "", projectKey: "" });
    setRefreshKey((key) => key + 1);
  }

  return (
    <SettingsShell title="Jira" description="Read recent issues from your Jira site">
      <Link
        href="/settings/connectors"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Connected apps
      </Link>

      {!status ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Jira…
        </div>
      ) : !status.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connect Jira</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {status.error?.startsWith("Connect ") ? null : status.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            {([
              ["baseUrl", "Site URL", "https://your-site.atlassian.net"],
              ["email", "Email", "you@example.com"],
              ["apiToken", "API token", ""],
              ["projectKey", "Project key (optional)", "PROJ"],
            ] as const).map(([key, label, placeholder]) => (
              <div className="space-y-1" key={key}>
                <Label htmlFor={`jira-${key}`}>{label}</Label>
                <Input
                  id={`jira-${key}`}
                  type={key === "apiToken" ? "password" : "text"}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <p>
              <span className="text-foreground">API token.</span> While signed into that
              account, create a token at{" "}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="text-[#0571d3] underline-offset-2 hover:underline"
              >
                id.atlassian.com/manage-profile/security/api-tokens
              </a>
              .
            </p>
            {error && <p className="text-destructive">{error}</p>}
            <Button type="button" size="sm" disabled={connecting} onClick={() => void connection("connect")}>
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="success">Connected</Badge>
              <span className="text-sm">
                <span className="font-medium">{status.siteName}</span>
                {status.account ? <span className="text-muted-foreground"> · {status.account}</span> : null}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setRefreshKey((key) => key + 1)}
                disabled={loading}
              >
                <RefreshCw className={loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => void connection("disconnect")}>Disconnect</Button>
            </CardContent>
          </Card>

          {status.projects && status.projects.length > 0 && (
            <p className="text-xs text-muted-foreground">Projects: {status.projects.join(", ")}</p>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent issues</CardTitle>
              <CardDescription className="text-xs">
                {syncedAt ? `Synced ${formatRelativeTime(syncedAt)}. ` : ""}
                Updated in the last 90 days. The chat uses this same list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {issues === null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading issues…
                </div>
              )}
              {issues?.length === 0 && (
                <p className="text-sm text-muted-foreground">No issues updated in the last 90 days.</p>
              )}
              {issues?.map((issue) => (
                <a
                  key={issue.key}
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-border px-3 py-2 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#0571d3]">{issue.key}</span>
                    <Badge variant="muted">{issue.status}</Badge>
                    <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-sm">{issue.summary}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {issue.type}
                    {issue.project ? ` · ${issue.project}` : ""} · {issue.assignee}
                  </p>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsShell>
  );
}
