import "server-only";

import { DatabricksApiError, runDatabricksQuery } from "@/lib/databricks/client";

export interface WarehouseQuery {
  sql: string;
  rowCount: number;
  error?: string;
}

export async function runWarehouseTool(input: unknown, rowCap: number): Promise<{ output: string; query: WarehouseQuery }> {
  const sql = sqlFrom(input);
  try {
    const result = await runDatabricksQuery(sql);
    const query = { sql, rowCount: result.rowCount };
    const output = JSON.stringify({
      columns: result.columns,
      rowCount: result.rowCount,
      rows: result.rows.slice(0, rowCap),
    }).slice(0, rowCap > 20 ? 12000 : 8000);
    return { output, query };
  } catch (error) {
    const message = error instanceof DatabricksApiError ? error.hint ?? error.message : "The query failed.";
    return { output: JSON.stringify({ error: message }), query: { sql, rowCount: 0, error: message } };
  }
}

function sqlFrom(input: unknown): string {
  if (typeof input === "string") {
    try {
      return sqlFrom(JSON.parse(input) as unknown);
    } catch {
      return input;
    }
  }
  if (input && typeof input === "object" && "sql" in input && typeof input.sql === "string") return input.sql;
  return "";
}
