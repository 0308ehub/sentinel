import "server-only";

import type {
  DatabricksCatalog,
  DatabricksQueryResult,
  DatabricksStatus,
} from "@/lib/databricks/types";

export class DatabricksApiError extends Error {
  constructor(
    public code: string,
    public hint?: string,
    public status = 502
  ) {
    super(code);
  }
}

const MISSING =
  "Add DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_HTTP_PATH to .env, then restart the dev server. The host is the workspace URL in the browser. The token is under your user icon, Settings, Developer, Access tokens. The HTTP path is on the SQL warehouse, under Connection details.";

interface DatabricksConfig {
  host: string;
  token: string;
  warehouseId: string;
  catalog?: string;
  schema?: string;
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function warehouseIdFrom(raw: string): string {
  const match = raw.match(/warehouses\/([A-Za-z0-9-]+)/);
  return match?.[1] ?? raw.replace(/^\/+/, "");
}

function readConfig(): DatabricksConfig | null {
  const hostRaw = process.env.DATABRICKS_HOST?.trim();
  const token = process.env.DATABRICKS_TOKEN?.trim();
  const pathRaw = process.env.DATABRICKS_HTTP_PATH?.trim() || process.env.DATABRICKS_WAREHOUSE_ID?.trim();
  if (!hostRaw || !token || !pathRaw) return null;

  let url: URL;
  try {
    url = new URL(hostRaw);
  } catch {
    throw new DatabricksApiError(
      "invalid_host",
      "DATABRICKS_HOST should look like https://dbc-xxxx.cloud.databricks.com",
      503
    );
  }
  if (url.protocol !== "https:" || blockedHost(url.hostname)) {
    throw new DatabricksApiError(
      "invalid_host",
      "DATABRICKS_HOST should be the https address of the Databricks workspace.",
      503
    );
  }
  const warehouseId = warehouseIdFrom(pathRaw);
  if (!warehouseId) {
    throw new DatabricksApiError(
      "invalid_warehouse",
      "DATABRICKS_HTTP_PATH should look like /sql/1.0/warehouses/your-warehouse-id",
      503
    );
  }
  return {
    host: url.origin,
    token,
    warehouseId,
    catalog: process.env.DATABRICKS_CATALOG?.trim() || undefined,
    schema: process.env.DATABRICKS_SCHEMA?.trim() || undefined,
  };
}

async function callDatabricks<T>(config: DatabricksConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.host}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    redirect: "manual",
  });

  if (res.status === 401) {
    throw new DatabricksApiError(
      "unauthorized",
      "Databricks rejected the token. Generate a new personal access token under your user icon, Settings, Developer, Access tokens.",
      401
    );
  }
  if (res.status === 403) {
    throw new DatabricksApiError(
      "forbidden",
      "This token can sign in, but it cannot read the warehouse or catalogs. Use a token for an account that can open the Kismet SQL warehouse.",
      403
    );
  }
  if (res.status === 404) {
    throw new DatabricksApiError(
      "not_found",
      "That workspace or warehouse was not found. Check DATABRICKS_HOST and the HTTP path on the SQL warehouse.",
      404
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ? ` ${body.message}` : "";
    } catch {
      detail = "";
    }
    throw new DatabricksApiError("databricks_error", `Databricks returned ${res.status}.${detail}`, res.status);
  }
  return (await res.json()) as T;
}

interface WarehouseInfo {
  name?: string;
  state?: string;
}

interface ScimMe {
  displayName?: string;
  userName?: string;
}

interface CatalogList {
  catalogs?: { name?: string }[];
}

interface SchemaList {
  schemas?: { name?: string }[];
}

interface TableList {
  tables?: { name?: string }[];
}

export async function getDatabricksStatus(): Promise<DatabricksStatus> {
  let config: DatabricksConfig | null;
  try {
    config = readConfig();
  } catch (error) {
    if (error instanceof DatabricksApiError) return { connected: false, error: error.hint ?? error.code };
    throw error;
  }
  if (!config) return { connected: false, error: MISSING };

  const [me, warehouse] = await Promise.all([
    callDatabricks<ScimMe>(config, "/api/2.0/preview/scim/Me").catch(() => ({}) as ScimMe),
    callDatabricks<WarehouseInfo>(config, `/api/2.0/sql/warehouses/${config.warehouseId}`),
  ]);

  return {
    connected: true,
    host: config.host.replace(/^https:\/\//, ""),
    account: me.displayName || me.userName,
    warehouseId: config.warehouseId,
    warehouseName: warehouse.name,
    warehouseState: warehouse.state,
    catalog: config.catalog,
    schema: config.schema,
  };
}

export async function listDatabricksCatalogs(): Promise<DatabricksCatalog[]> {
  const config = readConfig();
  if (!config) throw new DatabricksApiError("missing_config", MISSING, 503);

  const catalogBody = await callDatabricks<CatalogList>(config, "/api/2.0/unity-catalog/catalogs");
  const names = (catalogBody.catalogs ?? [])
    .map((catalog) => catalog.name)
    .filter((name): name is string => Boolean(name))
    .filter((name) => (config.catalog ? name === config.catalog : true))
    .slice(0, 12);

  const catalogs: DatabricksCatalog[] = [];
  for (const name of names) {
    const schemaBody = await callDatabricks<SchemaList>(
      config,
      `/api/2.0/unity-catalog/schemas?catalog_name=${encodeURIComponent(name)}`
    );
    const schemas = (schemaBody.schemas ?? [])
      .map((schema) => schema.name)
      .filter((schema): schema is string => Boolean(schema))
      .filter((schema) => (config.schema && name === config.catalog ? schema === config.schema : true))
      .slice(0, 8)
      .map((schema) => ({ name: schema, tables: [] as string[] }));

    const withTables = config.schema && name === config.catalog ? schemas.slice(0, 1) : schemas.slice(0, 2);
    for (const schema of withTables) {
      const tableBody = await callDatabricks<TableList>(
        config,
        `/api/2.0/unity-catalog/tables?catalog_name=${encodeURIComponent(name)}&schema_name=${encodeURIComponent(schema.name)}&max_results=40`
      );
      schema.tables = (tableBody.tables ?? [])
        .map((table) => table.name)
        .filter((table): table is string => Boolean(table))
        .slice(0, 40);
    }
    catalogs.push({ name, schemas });
  }
  return catalogs;
}

const READ_ONLY = /^(select|with|show|describe|desc|explain)\b/i;

export async function runDatabricksQuery(statement: string): Promise<DatabricksQueryResult> {
  const config = readConfig();
  if (!config) throw new DatabricksApiError("missing_config", MISSING, 503);

  const stripped = statement.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "").trim().replace(/;+\s*$/, "");
  if (!READ_ONLY.test(stripped) || /;\s*\S/.test(stripped)) {
    throw new DatabricksApiError(
      "read_only",
      "Kismet only runs one read query at a time: SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN.",
      400
    );
  }

  const started = Date.now();
  const initial = await callDatabricks<StatementResponse>(config, "/api/2.0/sql/statements", {
    method: "POST",
    body: JSON.stringify({
      warehouse_id: config.warehouseId,
      catalog: config.catalog,
      schema: config.schema,
      statement: stripped,
      wait_timeout: "30s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
      row_limit: 100,
    }),
  });

  let payload = initial;
  for (let attempt = 0; attempt < 10 && (payload.status?.state === "PENDING" || payload.status?.state === "RUNNING"); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    payload = await callDatabricks<StatementResponse>(config, `/api/2.0/sql/statements/${payload.statement_id}`);
  }

  if (payload.status?.state !== "SUCCEEDED") {
    throw new DatabricksApiError(
      "query_failed",
      payload.status?.error?.message ?? `The query ended as ${payload.status?.state ?? "unknown"}.`,
      400
    );
  }

  const columns = (payload.manifest?.schema?.columns ?? []).map((column) => column.name);
  const rows = (payload.result?.data_array ?? []).map((row) => {
    const record: Record<string, string | null> = {};
    columns.forEach((column, index) => {
      record[column] = row[index] ?? null;
    });
    return record;
  });

  return {
    columns,
    rows,
    rowCount: rows.length,
    durationMs: Date.now() - started,
  };
}

interface StatementResponse {
  statement_id?: string;
  status?: { state?: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: { name: string }[] } };
  result?: { data_array?: (string | null)[][] };
}

export function databricksErrorResponse(error: unknown): Response {
  if (error instanceof DatabricksApiError) {
    return Response.json({ error: error.code, hint: error.hint }, { status: error.status });
  }
  console.error("[databricks]", error);
  return Response.json({ error: "unknown_error" }, { status: 500 });
}
