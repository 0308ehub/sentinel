"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    setLoading(true);
    (async () => {
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

  return (
    <SettingsShell title="Jira" description="Read recent issues from the Kismet Jira site">
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
            <CardTitle className="text-sm">Add the Jira site to .env</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {status.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="text-foreground">JIRA_BASE_URL.</span> Open the Kismet workspace in
              Jira and copy the site address, like https://your-site.atlassian.net.
            </p>
            <p>
              <span className="text-foreground">JIRA_EMAIL.</span> The email of the Atlassian
              account that can see that workspace.
            </p>
            <p>
              <span className="text-foreground">JIRA_API_TOKEN.</span> While signed into that
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
            <p>Restart the dev server after saving .env, then check again.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
              <RefreshCw className="h-3 w-3" />
              Check again
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
