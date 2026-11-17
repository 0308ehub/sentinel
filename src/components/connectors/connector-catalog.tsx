"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CONNECTOR_CATEGORIES, CONNECTORS, type ConnectorDefinition, type ConnectorField } from "@/lib/connectors/catalog";
import { readSavedConnectors, removeConnector, savedConnector, writeConnector } from "@/lib/connectors/saved";
import { graphStore } from "@/lib/graph/graph-store";
import { CURRENT_USER } from "@/lib/settings";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface LiveState {
  connected: boolean;
  label?: string;
}

type LiveProvider = NonNullable<ConnectorDefinition["live"]>;

const SERVER_CREDENTIAL_PROVIDERS = new Set<LiveProvider>(["github", "slack", "jira", "databricks"]);

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fetchLiveState(provider: LiveProvider): Promise<LiveState> {
  try {
    const response = await fetch(`/api/${provider}/status`, { cache: "no-store" });
    const body = await responseJson(response);
    const connected = Boolean(body.connected);
    if (provider === "github") return { connected, label: connected ? textValue(body.login) : textValue(body.hint) };
    if (provider === "slack") return { connected, label: connected ? textValue(body.team) : textValue(body.error) };
    if (provider === "jira") return { connected, label: connected ? textValue(body.siteName) : textValue(body.error) };
    if (provider === "databricks") {
      return { connected, label: connected ? textValue(body.warehouseName) || textValue(body.host) : textValue(body.error) };
    }
    if (provider === "google") {
      return {
        connected,
        label: connected ? textValue(body.email) : body.configured ? undefined : "Needs a Google Cloud client",
      };
    }
    return { connected, label: connected ? textValue(body.database) : textValue(body.error) };
  } catch {
    return { connected: false };
  }
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isServerCredentialConnector(id: string): boolean {
  return SERVER_CREDENTIAL_PROVIDERS.has(id as LiveProvider);
}

async function postConnection(provider: LiveProvider, values: Record<string, string>) {
  const body = connectionBody(provider, values);
  const response = await fetch(`/api/${provider}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await responseJson(response);
  return { ok: response.ok, error: textValue(result.error) || `Could not connect ${provider}.` };
}

function connectionBody(provider: LiveProvider, values: Record<string, string>): Record<string, string | undefined> {
  if (provider === "github" || provider === "slack") return { token: values.token };
  if (provider === "jira") {
    return { baseUrl: values.site, email: values.email, apiToken: values.token };
  }
  return values;
}

export function ConnectorCatalog({ onConnectionsChange }: { onConnectionsChange?: (anyConnected: boolean) => void }) {
  const productId = useUIStore((s) => s.activeProductId);
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedConnectors().map((item) => item.id));
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  function refreshSaved() {
    const ids = readSavedConnectors().map((item) => item.id);
    setSavedIds(ids);
  }

  const refreshLive = useCallback(async (provider: LiveProvider) => {
    const state = await fetchLiveState(provider);
    setLive((current) => ({ ...current, [provider]: state }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLiveState("github"),
      fetchLiveState("slack"),
      fetchLiveState("jira"),
      fetchLiveState("databricks"),
      fetchLiveState("google"),
      fetchLiveState("postgres"),
    ]).then(([github, slack, jira, databricks, google, postgres]) => {
      if (cancelled) return;
      setLive({ github, slack, jira, databricks, google, postgres });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyConnected = Object.values(live).some((item) => item.connected);
  useEffect(() => {
    onConnectionsChange?.(anyConnected);
  }, [anyConnected, onConnectionsChange]);

  useEffect(() => {
    for (const connector of CONNECTORS) {
      if (!connector.live || !live[connector.live]?.connected) continue;
      graphStore.getState().attachSource({
        connectorId: connector.id,
        name: connector.name,
        filesAs: connector.filesAs,
        ownerId: CURRENT_USER.id,
        productId,
      });
    }
  }, [live, productId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CONNECTORS.filter((connector) => {
      if (!needle) return true;
      return (
        connector.name.toLowerCase().includes(needle) ||
        connector.category.toLowerCase().includes(needle) ||
        connector.filesAs.toLowerCase().includes(needle)
      );
    });
  }, [query]);
  const liveConnectors = filtered.filter((connector) => connector.live);
  const comingSoon = filtered.filter((connector) => !connector.live);
  const liveCount = CONNECTORS.filter((connector) => connector.live).length;
  const comingSoonCount = CONNECTORS.length - liveCount;

  const open = CONNECTORS.find((connector) => connector.id === openId) ?? null;

  return (
    <div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search connectors"
        className="h-9"
      />
      <p className="mt-3 text-xs text-muted-foreground">
        {liveCount} connectors work today; {comingSoonCount} more are coming soon.
      </p>
      <div className="mt-4 space-y-6">
        {CONNECTOR_CATEGORIES.map((category) => {
          const items = liveConnectors.filter((connector) => connector.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{category}</h2>
              <div className="mt-2 divide-y divide-border rounded-md border border-border">
                {items.map((connector) => {
                  const server = connector.live ? live[connector.live] : undefined;
                  const saved = savedIds.includes(connector.id);
                  const connected = Boolean(server?.connected);
                  const serverCredential = isServerCredentialConnector(connector.id);
                  const browserOnly = serverCredential && saved && !connected;
                  const locallyConnected = !serverCredential && saved;
                  return (
                    <div key={connector.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Mark name={connector.name} logo={connector.logo} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{connector.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Files {connector.filesAs}. {connector.flow}
                          {connected && server?.label
                            ? ` · ${server.label}`
                            : browserOnly
                              ? " · key saved in this browser only — open and save to connect"
                              : saved
                                ? " · key saved in this browser"
                                : ""}
                        </p>
                      </div>
                      <span className={cn("text-[11px]", connected || locallyConnected ? "text-foreground" : "text-muted-foreground")}>
                        {connected ? "Connected" : locallyConnected ? "Saved" : "Not connected"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={connected || locallyConnected || browserOnly ? "outline" : "default"}
                        onClick={() => setOpenId(connector.id)}
                      >
                        {connected || locallyConnected || browserOnly ? "Edit" : "Connect"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {comingSoon.length > 0 && (
          <details className="rounded-md border border-border" open={query.trim() ? true : undefined}>
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">
              Coming soon ({query.trim() ? comingSoon.length : comingSoonCount})
            </summary>
            <div className="divide-y divide-border border-t border-border">
              {comingSoon.map((connector) => {
                const saved = savedIds.includes(connector.id);
                return (
                  <div key={connector.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Mark name={connector.name} logo={connector.logo} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{connector.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {connector.category} · Files {connector.filesAs}.
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Coming soon</span>
                    {saved && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          removeConnector(connector.id);
                          graphStore.getState().detachSource(connector.id);
                          refreshSaved();
                        }}
                      >
                        Remove saved key
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpenId(null)}>
        {open && (
          <ConnectorForm
            connector={open}
            live={open.live ? live[open.live] : undefined}
            onClose={() => setOpenId(null)}
            onSaved={() => {
              writeAndFile(open, productId);
              refreshSaved();
              setOpenId(null);
            }}
            onRefreshLive={refreshLive}
            onRemoved={() => {
              graphStore.getState().detachSource(open.id);
              refreshSaved();
              setOpenId(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function writeAndFile(connector: ConnectorDefinition, productId: string) {
  graphStore.getState().attachSource({
    connectorId: connector.id,
    name: connector.name,
    filesAs: connector.filesAs,
    ownerId: CURRENT_USER.id,
    productId,
  });
}

function ConnectorForm({
  connector,
  live,
  onClose,
  onSaved,
  onRemoved,
  onRefreshLive,
}: {
  connector: ConnectorDefinition;
  live?: LiveState;
  onClose: () => void;
  onSaved: () => void;
  onRemoved: () => void;
  onRefreshLive: (provider: LiveProvider) => Promise<void>;
}) {
  const existing = savedConnector(connector.id);
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(existing?.values ?? {}) }));
  const [error, setError] = useState("");

  async function save() {
    const next: Record<string, string> = { ...(existing?.values ?? {}) };
    for (const field of connector.fields) {
      const value = values[field.key]?.trim() ?? "";
      if (field.kind === "secret" && !value && next[field.key]) continue;
      next[field.key] = value;
    }
    const missing = connector.fields.filter((field) => field.required && !next[field.key]?.trim());
    if (missing.length > 0 && !live?.connected) {
      setError(`Add ${missing.map((field) => field.label).join(", ")}.`);
      return;
    }
    if (connector.live && SERVER_CREDENTIAL_PROVIDERS.has(connector.live)) {
      const response = await postConnection(connector.live, next);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      removeConnector(connector.id);
      await onRefreshLive(connector.live);
    } else if (connector.id === "postgres" && next.url) {
      const response = await fetch("/api/postgres/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: next.url }),
      });
      const body = (await response.json()) as { connected?: boolean; error?: string };
      if (!body.connected) {
        setError(body.error || "Could not connect to that database.");
        return;
      }
    } else if (missing.length === 0) {
      writeConnector(connector.id, next);
    }
    onSaved();
  }

  async function disconnect() {
    if (connector.live && (SERVER_CREDENTIAL_PROVIDERS.has(connector.live) || connector.live === "postgres")) {
      const response = await fetch(`/api/${connector.live}/disconnect`, { method: "POST" });
      const body = await responseJson(response);
      if (!response.ok) {
        setError(textValue(body.error) || "Could not disconnect this connector.");
        return;
      }
      await onRefreshLive(connector.live);
    }
    removeConnector(connector.id);
    onRemoved();
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <h2 className="text-sm font-semibold">{connector.name}</h2>
      <p className="text-xs text-muted-foreground">
        {connector.description} {connector.flow}. Kismet files this as {connector.filesAs}.
      </p>
      {live?.connected && (
        <p className="text-xs text-muted-foreground">The workspace is already connected{live.label ? ` · ${live.label}` : ""}.</p>
      )}
      <div className="space-y-3">
        {connector.fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            saved={Boolean(existing?.values[field.key])}
            onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
          />
        ))}
      </div>
      {error && <p className="text-xs text-muted-foreground">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {existing || live?.connected ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {connector.setupHref && (
            <Button asChild variant={connector.fields.length === 0 ? "default" : "outline"} size="sm">
              <Link href={connector.setupHref} onClick={onClose}>
                {live?.connected ? "View" : "Workspace setup"}
              </Link>
            </Button>
          )}
          {connector.fields.length > 0 && (
            <Button type="button" size="sm" onClick={() => void save()}>
              Save
            </Button>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

function Field({
  field,
  value,
  saved,
  onChange,
}: {
  field: ConnectorField;
  value: string;
  saved: boolean;
  onChange: (value: string) => void;
}) {
  const placeholder = saved && field.kind === "secret" ? "Saved. Paste a new value to replace it." : field.placeholder;
  return (
    <label className="block">
      <span className="text-xs font-medium">
        {field.label}
        {!field.required ? " (optional)" : ""}
      </span>
      {field.kind === "textarea" ? (
        <Textarea className="mt-1" rows={4} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input
          className="mt-1 h-9"
          type={field.kind === "secret" ? "password" : field.kind === "email" ? "email" : field.kind === "url" ? "url" : "text"}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
      )}
    </label>
  );
}

function Mark({ name, logo }: { name: string; logo?: string }) {
  if (logo) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-white">
        <Image src={logo} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" unoptimized />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-xs font-medium">
      {name.slice(0, 1)}
    </div>
  );
}
