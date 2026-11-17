"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ToggleRow } from "@/components/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateWorkspace, useWorkspaceSettings } from "@/lib/settings/workspace";

interface RouteRow {
  label: string;
  title: string;
  reason: string;
}

interface ModelStatus {
  policy: string;
  claude: { configured: boolean; model: string };
  openai: { configured: boolean; model: string };
  routes: RouteRow[];
}

export function ModelsView() {
  const settings = useWorkspaceSettings();
  const [status, setStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    void fetch("/api/models/status", { cache: "no-store" })
      .then((res) => res.json() as Promise<ModelStatus>)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <SettingsShell title="AI" description="Which model answers, and what a draft is allowed to read">
      <div className="space-y-4">
      {!status ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking models…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProviderCard name="Claude" model={status.claude.model} configured={status.claude.configured} env="ANTHROPIC_API_KEY" />
            <ProviderCard name="OpenAI" model={status.openai.model} configured={status.openai.configured} env="OPENAI_API_KEY" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How a request is routed</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Policy is {status.policy}. Chat and recommendations use Claude when that key is set. Short drafts stay on OpenAI, which enforces the JSON shape. If the chosen model fails, the same request runs on the other one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {status.routes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env and restart the dev server.</p>
              ) : (
                status.routes.map((route) => (
                  <div key={route.label} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">{route.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {route.title} · {route.reason}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Context</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Chat, agents, and PRD drafts leave out a source when it is off.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border p-0">
              <ToggleRow
                title="Product graph"
                description="Pages on the graph, features, experiments, and linked PRD evidence."
                checked={settings.aiGraph}
                onCheckedChange={(aiGraph) => updateWorkspace({ aiGraph })}
              />
              <ToggleRow
                title="Connected apps"
                description="Slack, Jira, and Databricks excerpts in a draft."
                checked={settings.aiConnectors}
                onCheckedChange={(aiConnectors) => updateWorkspace({ aiConnectors })}
              />
              <ToggleRow
                title="Open pages and work log"
                description="The pages you have had open, and the short log of what you have been doing."
                checked={settings.aiChat}
                onCheckedChange={(aiChat) => updateWorkspace({ aiChat })}
              />
            </CardContent>
          </Card>
      </div>
    </SettingsShell>
  );
}

function ProviderCard({ name, model, configured, env }: { name: string; model: string; configured: boolean; env: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{name}</CardTitle>
          <Badge variant={configured ? "success" : "muted"}>{configured ? "Ready" : "No key"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-4 pt-0">
        <p className="font-mono text-[11px] text-muted-foreground">{model}</p>
        {!configured && <p className="text-[11px] text-muted-foreground">Set {env} and restart the dev server.</p>}
      </CardContent>
    </Card>
  );
}
