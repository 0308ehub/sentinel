import "server-only";

import { databricksConnectionKey, listDatabricksCatalogs, getDatabricksStatus } from "@/lib/databricks/client";

const CACHE_MS = 5 * 60_000;

const cache = new Map<string, { at: number; text: string }>();

export async function getDatabricksPrompt(): Promise<string> {
  const key = await databricksConnectionKey();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.text;

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
  cache.set(key, { at: Date.now(), text });
  return text;
}
