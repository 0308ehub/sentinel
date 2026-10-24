export type DataSourceKind = "postgres" | "mongodb" | "firebase" | "bigquery";

export interface DataColumn {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

export interface DataTable {
  id: string;
  name: string;
  kind: "table" | "collection";
  description: string;
  rowCount: number;
  sizeMB: number;
  lastSynced: string;
  columns: DataColumn[];
  sampleRows: Record<string, unknown>[];
}

export interface DataSource {
  id: string;
  name: string;
  kind: DataSourceKind;
  status: "connected" | "syncing" | "error";
  host: string;
  description: string;
  lastSynced: string;
  tables: DataTable[];
}

export const DATA_SOURCES: DataSource[] = [];

export function getDataSource(id: string): DataSource | undefined {
  return DATA_SOURCES.find((d) => d.id === id);
}

export function getDataTable(tableId: string): { source: DataSource; table: DataTable } | undefined {
  for (const source of DATA_SOURCES) {
    const table = source.tables.find((t) => t.id === tableId);
    if (table) return { source, table };
  }
  return undefined;
}

export function formatRowCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function generateSQLFromPrompt(
  prompt: string,
  table: DataTable,
  source: DataSource
): { sql: string; explanation: string } {
  const cols = table.columns
    .slice(0, 5)
    .map((c) => c.name)
    .join(", ");
  return {
    sql: `-- ${source.name}.${table.name}\n-- ${prompt.trim()}\nSELECT ${cols || "*"}\nFROM ${table.name}\nLIMIT 100;`,
    explanation: `Draft over ${table.name}. No warehouse is connected, so this query has nowhere to run.`,
  };
}
