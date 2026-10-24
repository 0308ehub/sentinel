"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DatabricksCatalog, DatabricksQueryResult, DatabricksStatus } from "@/lib/databricks/types";
import { ChevronDown, ChevronRight, CircleCheck, Database, Loader2, Table2 } from "lucide-react";

interface DataSourcesPanelProps {
  onInsertQuery: (sql: string, name?: string) => void;
}

interface TableRef {
  catalog: string;
  schema: string;
  table: string;
}

export function DataSourcesPanel({ onInsertQuery }: DataSourcesPanelProps) {
  const [status, setStatus] = useState<DatabricksStatus | null>(null);
  const [catalogs, setCatalogs] = useState<DatabricksCatalog[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ databricks: true });
  const [selected, setSelected] = useState<TableRef | null>(null);
  const [preview, setPreview] = useState<DatabricksQueryResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await fetch("/api/databricks/status", { cache: "no-store" })
        .then((res) => res.json() as Promise<DatabricksStatus>)
        .catch((): DatabricksStatus => ({ connected: false, error: "Could not reach Databricks." }));
      if (cancelled) return;
      setStatus(next);
      if (!next.connected) return;
      try {
        const res = await fetch("/api/databricks/catalogs", { cache: "no-store" });
        const body = (await res.json()) as { catalogs?: DatabricksCatalog[]; hint?: string; error?: string };
        if (!res.ok) throw new Error(body.hint ?? body.error ?? "Could not list catalogs.");
        if (cancelled) return;
        const list = body.catalogs ?? [];
        setCatalogs(list);
        const first =
          list.find(
            (catalog) =>
              catalog.name === "samples" && catalog.schemas.some((schema) => schema.tables.length > 0)
          ) ??
          list.find((catalog) =>
            catalog.schemas.some((schema) => schema.name !== "information_schema" && schema.tables.length > 0)
          ) ??
          list[0];
        const schema =
          first?.schemas.find((item) => item.name !== "information_schema" && item.tables.length > 0) ??
          first?.schemas.find((item) => item.tables.length > 0) ??
          first?.schemas[0];
        setOpen((prev) => ({
          ...prev,
          databricks: true,
          ...(first ? { [first.name]: true } : {}),
          ...(first && schema ? { [`${first.name}.${schema.name}`]: true } : {}),
        }));
      } catch (reason) {
        if (!cancelled) setCatalogError((reason as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    const name = qualified(selected);
    if (!name) {
      setPreviewError("That table name cannot be previewed.");
      setPreviewLoading(false);
      return;
    }
    const statement = `SELECT * FROM ${name} LIMIT 20`;
    fetch("/api/databricks/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement }),
    })
      .then(async (res) => {
        const body = (await res.json()) as DatabricksQueryResult & { hint?: string; error?: string };
        if (!res.ok) throw new Error(body.hint ?? body.error ?? "The preview query failed.");
        if (!cancelled) setPreview(body);
      })
      .catch((reason: Error) => {
        if (!cancelled) setPreviewError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const connected = Boolean(status?.connected);
  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-xs font-medium">Connected Sources</span>
          <Badge variant="secondary" className="text-[10px]">
            {status === null ? "…" : connected ? "1" : "0"}
          </Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {connected && status && (
              <div>
                <button
                  type="button"
                  onClick={() => toggle("databricks")}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                >
                  {open.databricks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Database className="h-3.5 w-3.5 shrink-0 text-[#ff3621]" />
                  <span className="truncate font-medium">{status.warehouseName ?? "Databricks"}</span>
                  <CircleCheck className="ml-auto h-3 w-3 shrink-0 text-success" />
                </button>
                {open.databricks && (
                  <div className="ml-4 border-l border-border py-0.5 pl-2">
                    <p className="truncate px-2 text-[10px] text-muted-foreground" title={status.host}>
                      {status.host}
                    </p>
                    {catalogs === null && !catalogError && (
                      <p className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading catalogs
                      </p>
                    )}
                    {catalogError && <p className="px-2 py-1 text-[11px] text-destructive">{catalogError}</p>}
                    {catalogs?.map((catalog) => (
                      <CatalogBranch
                        key={catalog.name}
                        catalog={catalog}
                        open={open}
                        selected={selected}
                        onToggle={toggle}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button variant="outline" size="sm" className="w-full text-xs" asChild>
            <Link href="/settings/connectors">
              <Database className="mr-1 h-3 w-3" />
              Connect source
            </Link>
          </Button>
        </div>
      </div>

      {!status ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Databricks…
        </div>
      ) : !connected ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No databases connected.{" "}
          <Link href="/settings/connectors/databricks" className="text-[#0571d3] underline-offset-2 hover:underline">
            Set up Databricks
          </Link>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="max-w-4xl space-y-5 p-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Database className="h-3.5 w-3.5 text-[#ff3621]" />
                <span>Databricks</span>
                <Badge variant="success" className="text-[10px]">
                  Connected
                </Badge>
                {status.warehouseState && <Badge variant="muted">{status.warehouseState}</Badge>}
              </div>
              <h2 className="mt-1 text-lg font-semibold">{status.warehouseName ?? status.host}</h2>
              <p className="text-sm text-muted-foreground">
                {status.host}
                {status.account ? ` · ${status.account}` : ""}
              </p>
            </div>

            {selected ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm font-medium">
                    {qualified(selected)?.replace(/`/g, "") ?? selected.table}
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={!qualified(selected)}
                    onClick={() => {
                      const name = qualified(selected);
                      if (!name) return;
                      onInsertQuery(`SELECT *\nFROM ${name}\nLIMIT 100`, selected.table);
                    }}
                  >
                    Open in notebooks
                  </Button>
                </div>
                {previewLoading && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Reading a sample from the warehouse
                  </p>
                )}
                {previewError && <p className="text-xs text-destructive">{previewError}</p>}
                {preview && preview.columns.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full whitespace-nowrap text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          {preview.columns.map((column) => (
                            <th key={column} className="px-3 py-2 text-left font-mono font-medium">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, index) => (
                          <tr key={index} className="border-b border-border font-mono last:border-0">
                            {preview.columns.map((column) => (
                              <td
                                key={column}
                                className={cn("px-3 py-2", row[column] === null && "italic text-muted-foreground")}
                              >
                                {row[column] === null ? "null" : row[column]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {preview && preview.rows.length === 0 && !previewLoading && (
                  <p className="text-xs text-muted-foreground">The table returned no rows.</p>
                )}
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a table to preview its rows.</p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function CatalogBranch({
  catalog,
  open,
  selected,
  onToggle,
  onSelect,
}: {
  catalog: DatabricksCatalog;
  open: Record<string, boolean>;
  selected: TableRef | null;
  onToggle: (id: string) => void;
  onSelect: (table: TableRef) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(catalog.name)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted"
      >
        {open[catalog.name] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="truncate font-mono">{catalog.name}</span>
      </button>
      {open[catalog.name] &&
        catalog.schemas.map((schema) => {
          const key = `${catalog.name}.${schema.name}`;
          return (
            <div key={schema.name} className="ml-3">
              <button
                type="button"
                onClick={() => onToggle(key)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted"
              >
                {open[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="truncate font-mono text-muted-foreground">{schema.name}</span>
              </button>
              {open[key] &&
                schema.tables.map((table) => {
                  const active =
                    selected?.catalog === catalog.name && selected.schema === schema.name && selected.table === table;
                  return (
                    <button
                      key={table}
                      type="button"
                      onClick={() => onSelect({ catalog: catalog.name, schema: schema.name, table })}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                        active ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
                      )}
                    >
                      <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono">{table}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
    </div>
  );
}

function qualified(table: TableRef): string | null {
  const parts = [table.catalog, table.schema, table.table].map(quoteIdent);
  if (parts.some((part) => !part)) return null;
  return parts.join(".");
}

function quoteIdent(value: string): string | null {
  if (!/^[\w-]+$/.test(value)) return null;
  return `\`${value}\``;
}
