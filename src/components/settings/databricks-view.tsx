"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatabricksApiErrorBody, DatabricksCatalog, DatabricksStatus } from "@/lib/databricks/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) {
    const err = body as DatabricksApiErrorBody;
    throw new Error(err.hint ?? err.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function DatabricksView() {
  const [status, setStatus] = useState<DatabricksStatus | null>(null);
  const [catalogs, setCatalogs] = useState<DatabricksCatalog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getJson<DatabricksStatus>("/api/databricks/status").catch(
        (reason: Error): DatabricksStatus => ({ connected: false, error: reason.message })
      );
      if (cancelled) return;
      setStatus(next);
      if (!next.connected) {
        setCatalogs(null);
        return;
      }
      try {
        const body = await getJson<{ catalogs: DatabricksCatalog[] }>("/api/databricks/catalogs");
        if (!cancelled) {
          setCatalogs(body.catalogs);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) setError((reason as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <SettingsShell title="Databricks" description="Read the Kismet SQL warehouse">
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
          Checking Databricks…
        </div>
      ) : !status.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add the Databricks workspace to .env</CardTitle>
            <CardDescription className="text-xs leading-relaxed">{status.error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="text-foreground">DATABRICKS_HOST.</span> The workspace URL in the
              browser, like https://dbc-xxxx.cloud.databricks.com.
            </p>
            <p>
              <span className="text-foreground">DATABRICKS_TOKEN.</span> Click your user icon,
              then Settings, Developer, Access tokens, and generate a token.
            </p>
            <p>
              <span className="text-foreground">DATABRICKS_HTTP_PATH.</span> Open SQL Warehouses,
              choose the Kismet warehouse, then Connection details. Copy the HTTP path. It looks
              like /sql/1.0/warehouses/abc123.
            </p>
            <p>
              <span className="text-foreground">DATABRICKS_CATALOG and DATABRICKS_SCHEMA</span> are
              optional. Set them if Kismet should open one catalog instead of the workspace
              default.
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
                <span className="font-medium">{status.warehouseName ?? status.host}</span>
                {status.account ? <span className="text-muted-foreground"> · {status.account}</span> : null}
              </span>
              {status.warehouseState && <Badge variant="muted">{status.warehouseState}</Badge>}
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Catalogs</CardTitle>
              <CardDescription className="text-xs">
                Unity Catalog on {status.host}. Analytics queries run on this warehouse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              {catalogs === null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading catalogs…
                </div>
              )}
              {catalogs?.length === 0 && (
                <p className="text-sm text-muted-foreground">No catalogs were returned for this token.</p>
              )}
              {catalogs?.map((catalog) => (
                <div key={catalog.name}>
                  <p className="font-mono text-xs text-[#0571d3]">{catalog.name}</p>
                  <ul className="mt-1 space-y-1">
                    {catalog.schemas.map((schema) => (
                      <li key={schema.name} className="text-xs text-muted-foreground">
                        <span className="text-foreground">{schema.name}</span>
                        {schema.tables.length > 0 ? ` · ${schema.tables.join(", ")}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsShell>
  );
}
