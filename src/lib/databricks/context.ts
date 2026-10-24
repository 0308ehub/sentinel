import "server-only";

import { listDatabricksCatalogs, getDatabricksStatus } from "@/lib/databricks/client";

const CACHE_MS = 5 * 60_000;

let cache: { at: number; text: string } | null = null;

export async function getDatabricksPrompt(): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.text;

  const status = await getDatabricksStatus();
  if (!status.connected) return "";

  let body = "";
  try {
    const catalogs = await listDatabricksCatalogs();
    body = catalogs
      .map((catalog) => {
        const schemas = catalog.schemas
          .map((schema) => {
            const tables = schema.tables.length ? `: ${schema.tables.slice(0, 12).join(", ")}` : "";
            return `  ${catalog.name}.${schema.name}${tables}`;
          })
          .join("\n");
        return schemas || catalog.name;
      })
      .join("\n");
  } catch {
    body = "Catalog list could not be loaded. Use SHOW CATALOGS and SHOW TABLES to find a table.";
  }

  const text = [
    `Databricks warehouse ${status.warehouseName ?? status.host} is connected.`,
    "Write SQL with three-part names: catalog.schema.table. The samples catalog is the sample warehouse.",
    body,
  ]
    .filter(Boolean)
    .join("\n");
  cache = { at: Date.now(), text };
  return text;
}
