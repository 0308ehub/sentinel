"use client";

import { useEffect, useMemo, useState } from "react";
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

export function ConnectorCatalog({ onConnectionsChange }: { onConnectionsChange?: (anyConnected: boolean) => void }) {
  const productId = useUIStore((s) => s.activeProductId);
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  function refreshSaved() {
    const ids = readSavedConnectors().map((item) => item.id);
    setSavedIds(ids);
  }

  useEffect(() => {
    refreshSaved();
    let cancelled = false;
    Promise.all([
      fetch("/api/slack/status", { cache: "no-store" }).then((res) => res.json()).catch(() => ({ connected: false })),
      fetch("/api/jira/status", { cache: "no-store" }).then((res) => res.json()).catch(() => ({ connected: false })),
      fetch("/api/databricks/status", { cache: "no-store" }).then((res) => res.json()).catch(() => ({ connected: false })),
      fetch("/api/google/status", { cache: "no-store" }).then((res) => res.json()).catch(() => ({ connected: false })),
    ]).then(([slack, jira, databricks, google]) => {
      if (cancelled) return;
      setLive({
        slack: {
          connected: Boolean(slack.connected),
          label: slack.connected ? slack.team : slack.error,
        },
        jira: {
          connected: Boolean(jira.connected),
          label: jira.connected ? jira.siteName : jira.error,
        },
        databricks: {
          connected: Boolean(databricks.connected),
          label: databricks.connected ? databricks.warehouseName || databricks.host : databricks.error,
        },
        google: {
          connected: Boolean(google.connected),
          label: google.connected ? google.email : google.configured ? undefined : "Needs a Google Cloud client",
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyConnected = savedIds.length > 0 || Object.values(live).some((item) => item.connected);
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
        {CONNECTORS.length} tools. Each one asks for the URL or key it needs, then Kismet files what it produces onto the product graph.
      </p>
      <div className="mt-4 space-y-6">
        {CONNECTOR_CATEGORIES.map((category) => {
          const items = filtered.filter((connector) => connector.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{category}</h2>
              <div className="mt-2 divide-y divide-border rounded-md border border-border">
                {items.map((connector) => {
                  const server = connector.live ? live[connector.live] : undefined;
                  const saved = savedIds.includes(connector.id);
                  const connected = Boolean(server?.connected);
                  return (
                    <div key={connector.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Mark name={connector.name} logo={connector.logo} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{connector.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Files {connector.filesAs}. {connector.flow}
                          {connected && server?.label ? ` · ${server.label}` : saved ? " · key saved in this browser" : ""}
                        </p>
                      </div>
                      <span className={cn("text-[11px]", connected || saved ? "text-foreground" : "text-muted-foreground")}>
                        {connected ? "Connected" : saved ? "Saved" : "Not connected"}
                      </span>
                      <Button type="button" size="sm" variant={connected || saved ? "outline" : "default"} onClick={() => setOpenId(connector.id)}>
                        {connected || saved ? "Edit" : "Connect"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpenId(null)}>
        {open && (
          <ConnectorForm
            connector={open}
            live={open.live ? live[open.live] : undefined}
            onClose={() => setOpenId(null)}
            onSaved={() => {
              const label = writeAndFile(open, productId);
              if (label) refreshSaved();
              setOpenId(null);
            }}
            onRemoved={() => {
              removeConnector(open.id);
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
  return true;
}

function ConnectorForm({
  connector,
  live,
  onClose,
  onSaved,
  onRemoved,
}: {
  connector: ConnectorDefinition;
  live?: LiveState;
  onClose: () => void;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const existing = savedConnector(connector.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function save() {
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
    if (missing.length === 0) writeConnector(connector.id, next);
    onSaved();
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
        {existing ? (
          <Button type="button" variant="outline" size="sm" onClick={onRemoved}>
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
            <Button type="button" size="sm" onClick={save}>
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
