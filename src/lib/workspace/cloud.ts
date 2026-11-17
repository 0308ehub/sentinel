import "server-only";

import { autopilotConfigured, db } from "@/lib/autopilot/db";

const WORKSPACE_ID = process.env.KISMET_WORKSPACE_ID?.trim() || "kismet";

const STARTER_NOTE = {
  id: "note_kismet",
  title: "This product",
  body: "Kismet is the product this workspace is about. Write who it is for, what is still missing, and what you want to learn. The chat can see these notes, the product graph, and GitHub when a token is connected.",
  at: "2026-11-17T00:00:00.000Z",
};

export interface WorkspaceNote {
  id: string;
  title: string;
  body: string;
  at: string;
}

export interface WorkspaceRecord {
  graph: unknown;
  graphAt: string | null;
  chat: unknown;
  chatAt: string | null;
  notes: WorkspaceNote[];
  notesAt: string | null;
}

let tableReady: Promise<void> | null = null;

export async function readWorkspace(): Promise<WorkspaceRecord | null> {
  if (!autopilotConfigured()) return null;
  const sql = await db();
  await ensureWorkspace(sql);
  await sql`
    insert into kismet.workspace (id, notes, notes_at)
    values (${WORKSPACE_ID}, ${sql.json([STARTER_NOTE])}, now())
    on conflict (id) do nothing
  `;
  const rows = await sql<Row[]>`
    select graph, graph_at, chat, chat_at, notes, notes_at
    from kismet.workspace
    where id = ${WORKSPACE_ID}
  `;
  const row = rows[0];
  if (!row) return { graph: null, graphAt: null, chat: null, chatAt: null, notes: [STARTER_NOTE], notesAt: null };
  return {
    graph: row.graph ?? null,
    graphAt: stamp(row.graph_at),
    chat: row.chat ?? null,
    chatAt: stamp(row.chat_at),
    notes: notesOf(row.notes),
    notesAt: stamp(row.notes_at),
  };
}

export async function saveWorkspacePart(
  kind: "graph" | "chat",
  body: unknown,
  expected: string | null,
): Promise<{ at: string } | { conflict: true }> {
  const sql = await db();
  await ensureWorkspace(sql);
  const rows =
    kind === "graph"
      ? await sql<Stamp[]>`
          update kismet.workspace
          set graph = ${sql.json(body as never)}, graph_at = now()
          where id = ${WORKSPACE_ID}
            and ((graph_at is null and ${expected}::timestamptz is null) or date_trunc('milliseconds', graph_at) = date_trunc('milliseconds', ${expected}::timestamptz))
          returning graph_at as at
        `
      : await sql<Stamp[]>`
          update kismet.workspace
          set chat = ${sql.json(body as never)}, chat_at = now()
          where id = ${WORKSPACE_ID}
            and ((chat_at is null and ${expected}::timestamptz is null) or date_trunc('milliseconds', chat_at) = date_trunc('milliseconds', ${expected}::timestamptz))
          returning chat_at as at
        `;
  const at = stamp(rows[0]?.at);
  if (!at) return { conflict: true };
  return { at };
}

export async function addWorkspaceNote(title: string, body: string): Promise<WorkspaceNote[]> {
  const sql = await db();
  await ensureWorkspace(sql);
  const note: WorkspaceNote = {
    id: `note_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    title: title.slice(0, 120),
    body: body.slice(0, 4000),
    at: new Date().toISOString(),
  };
  return sql.begin(async (tx) => {
    const rows = await tx<Row[]>`
      select notes from kismet.workspace where id = ${WORKSPACE_ID} for update
    `;
    const notes = [note, ...notesOf(rows[0]?.notes)].slice(0, 100);
    await tx`
      update kismet.workspace
      set notes = ${tx.json(notes as never)}, notes_at = now()
      where id = ${WORKSPACE_ID}
    `;
    return notes;
  });
}

export async function removeWorkspaceNote(id: string): Promise<WorkspaceNote[]> {
  const sql = await db();
  await ensureWorkspace(sql);
  return sql.begin(async (tx) => {
    const rows = await tx<Row[]>`
      select notes from kismet.workspace where id = ${WORKSPACE_ID} for update
    `;
    const notes = notesOf(rows[0]?.notes).filter((note) => note.id !== id);
    await tx`
      update kismet.workspace
      set notes = ${tx.json(notes as never)}, notes_at = now()
      where id = ${WORKSPACE_ID}
    `;
    return notes;
  });
}

const GRAPH_TYPES = new Set(["PRODUCT", "FEATURE", "DECISION", "CUSTOMER_PROBLEM", "GOAL", "EXPERIMENT"]);

/** Text the model can read when Slack and Jira are still empty. */
export async function workspaceBrief(): Promise<string> {
  const record = await readWorkspace().catch(() => null);
  if (!record) return "";
  const notes = record.notes
    .slice(0, 40)
    .map((note) => `- ${note.title}: ${note.body.replace(/\s+/g, " ").trim()}`)
    .join("\n");
  const graph = graphBrief(record.graph);
  return [
    notes ? `Notes written in this Kismet workspace:\n${notes}` : "",
    graph ? `Product graph:\n${graph}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);
}

function graphBrief(value: unknown): string {
  if (!value || typeof value !== "object" || !("nodes" in value) || !Array.isArray(value.nodes)) return "";
  const lines: string[] = [];
  for (const node of value.nodes) {
    if (!node || typeof node !== "object") continue;
    const row = node as { type?: unknown; title?: unknown; description?: unknown; summary?: unknown; status?: unknown };
    if (typeof row.type !== "string" || !GRAPH_TYPES.has(row.type) || typeof row.title !== "string") continue;
    const detail = typeof row.description === "string" ? row.description : typeof row.summary === "string" ? row.summary : "";
    const status = typeof row.status === "string" ? row.status : "";
    lines.push(`- ${row.type} (${status}): ${row.title}${detail ? ` — ${detail.replace(/\s+/g, " ").trim().slice(0, 240)}` : ""}`);
    if (lines.length >= 40) break;
  }
  return lines.join("\n");
}

async function ensureWorkspace(sql: Awaited<ReturnType<typeof db>>) {
  tableReady ??= sql`
    create table if not exists kismet.workspace (
      id text primary key,
      graph jsonb,
      graph_at timestamptz,
      chat jsonb,
      chat_at timestamptz,
      notes jsonb not null default '[]'::jsonb,
      notes_at timestamptz
    )
  `.then(() => undefined);
  await tableReady;
}

function notesOf(value: unknown): WorkspaceNote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const note = item as Partial<WorkspaceNote>;
    if (typeof note.id !== "string" || typeof note.title !== "string" || typeof note.body !== "string") return [];
    return [{ id: note.id, title: note.title, body: note.body, at: typeof note.at === "string" ? note.at : "" }];
  });
}

function stamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

interface Row {
  graph: unknown;
  graph_at: unknown;
  chat: unknown;
  chat_at: unknown;
  notes: unknown;
  notes_at: unknown;
}

interface Stamp {
  at: unknown;
}
