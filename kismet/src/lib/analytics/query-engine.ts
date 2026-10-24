import { DATA_SOURCES } from "@/lib/data/data-sources";

export type CellType = "markdown" | "sql" | "python";

export type CellOutput =
  | {
      kind: "table";
      columns: string[];
      rows: QueryResultRow[];
      rowCount: number;
      durationMs: number;
    }
  | { kind: "text"; text: string; durationMs?: number }
  | { kind: "error"; message: string };

export interface NotebookCell {
  id: string;
  type: CellType;
  source: string;
  output?: CellOutput;
}

export interface SavedNotebook {
  id: string;
  name: string;
  cells: NotebookCell[];
  linkedNodeId?: string;
  createdAt: string;
  updatedAt: string;
  source: "manual" | "ai";
}

/** @deprecated Prefer SavedNotebook — kept for migration from old persisted state */
export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
  source: "manual" | "ai";
}

export interface NotebookDoc {
  id: string;
  name: string;
  cells: NotebookCell[];
  savedNotebookId?: string;
  isDirty: boolean;
  aiGenerated?: boolean;
  linkedNodeId?: string;
}

/** @deprecated Prefer NotebookDoc */
export type QueryTab = NotebookDoc & { sql?: string };

export interface QueryResultRow {
  [key: string]: string | number | null;
}

let cellCounter = 1;
let untitledCounter = 1;

export function createCellId(): string {
  return `cell-${Date.now()}-${cellCounter++}`;
}

export function createCell(type: CellType, source = ""): NotebookCell {
  const defaults: Record<CellType, string> = {
    markdown: "## Notes\n\nWrite product context or hypotheses here.",
    sql: "-- Connect a database before running a query.\n",
    python:
      "# `df` is the last SQL result (list of row dicts)\nprint(f\"rows: {len(df)}\")\ndf[:3] if df else []",
  };
  return {
    id: createCellId(),
    type,
    source: source || defaults[type],
  };
}

export function createEmptyNotebook(name?: string): NotebookDoc {
  const n = untitledCounter++;
  return {
    id: `nb-${Date.now()}-${n}`,
    name: name ?? `Untitled-${n}`,
    cells: [createCell("sql", "")],
    isDirty: false,
  };
}

/** @deprecated */
export function createEmptyTab(): NotebookDoc {
  return createEmptyNotebook();
}

function cloneCells(cells: NotebookCell[]): NotebookCell[] {
  return cells.map((c) => ({
    ...c,
    id: createCellId(),
    output: undefined,
  }));
}

export function notebookFromSaved(saved: SavedNotebook): NotebookDoc {
  return {
    id: `nb-${Date.now()}-${untitledCounter++}`,
    name: saved.name,
    cells: cloneCells(saved.cells),
    savedNotebookId: saved.id,
    isDirty: false,
    aiGenerated: saved.source === "ai",
    linkedNodeId: saved.linkedNodeId,
  };
}

export function cellsFingerprint(cells: NotebookCell[]): string {
  return JSON.stringify(cells.map((c) => ({ type: c.type, source: c.source })));
}

export function migrateSavedQueryToNotebook(q: SavedQuery): SavedNotebook {
  return {
    id: q.id,
    name: q.name,
    cells: [
      {
        id: createCellId(),
        type: "sql",
        source: q.sql,
      },
    ],
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    source: q.source,
  };
}

export function isLegacySavedQuery(value: unknown): value is SavedQuery {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.sql === "string" && !Array.isArray(v.cells);
}

export const INITIAL_SAVED_NOTEBOOKS: SavedNotebook[] = [];

/** @deprecated */
export const INITIAL_SAVED_QUERIES = INITIAL_SAVED_NOTEBOOKS.map((nb) => ({
  id: nb.id,
  name: nb.name,
  sql: nb.cells.find((c) => c.type === "sql")?.source ?? "",
  createdAt: nb.createdAt,
  updatedAt: nb.updatedAt,
  source: nb.source,
}));

export function buildSchemaContext(): string {
  return DATA_SOURCES.map((source) => {
    const tables = source.tables
      .map((t) => {
        const cols = t.columns
          .map(
            (c) =>
              `    ${c.name} ${c.type}${c.nullable ? "" : " NOT NULL"} — ${c.description}`
          )
          .join("\n");
        return `  ${t.name} (${t.kind}, ~${t.rowCount.toLocaleString()} rows)\n${cols}`;
      })
      .join("\n\n");
    return `-- ${source.name} (${source.kind}) @ ${source.host}\n${tables}`;
  }).join("\n\n");
}

function titleFromPrompt(prompt: string): string {
  const cleaned = prompt.trim().replace(/\?+$/, "");
  if (cleaned.length <= 48) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned.slice(0, 45).trim() + "…";
}

export function generateQueryFromPrompt(prompt: string): {
  sql: string;
  name: string;
  explanation: string;
} {
  return {
    name: titleFromPrompt(prompt) || "Query",
    sql: "-- Ask a question about a table in the connected Databricks catalog.",
    explanation: "Queries run on the Databricks SQL warehouse once it is connected in Settings.",
  };
}

export function mockExecuteQuery(_sql: string): {
  columns: string[];
  rows: QueryResultRow[];
  rowCount: number;
  durationMs: number;
} {
  return {
    columns: ["note"],
    rows: [],
    rowCount: 0,
    durationMs: 1,
  };
}
