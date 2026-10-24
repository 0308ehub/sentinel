export interface DatabricksStatus {
  connected: boolean;
  host?: string;
  account?: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseState?: string;
  catalog?: string;
  schema?: string;
  error?: string;
}

export interface DatabricksSchema {
  name: string;
  tables: string[];
}

export interface DatabricksCatalog {
  name: string;
  schemas: DatabricksSchema[];
}

export interface DatabricksQueryResult {
  columns: string[];
  rows: Record<string, string | null>[];
  rowCount: number;
  durationMs: number;
}

export interface DatabricksApiErrorBody {
  error: string;
  hint?: string;
}
