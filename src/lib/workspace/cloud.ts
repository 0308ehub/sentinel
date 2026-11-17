import "server-only";

import { autopilotConfigured, db } from "@/lib/autopilot/db";
import { loadStates } from "@/lib/workspace/state-store";

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

let tableReady: Promise<void> | null = null;

export async function readWorkspaceNotes(userId: string): Promise<WorkspaceNote[] | null> {
  if (!autopilotConfigured()) return null;
  const sql = await db();
  await ensureWorkspace(sql);
  await sql`
    insert into kismet.workspace (id, notes, notes_at)
    values (${userId}, ${sql.json([STARTER_NOTE])}, now())
    on conflict (id) do nothing
  `;
  const rows = await sql<Row[]>`
    select notes
    from kismet.workspace
    where id = ${userId}
  `;
  return notesOf(rows[0]?.notes);
}

export async function addWorkspaceNote(userId: string, title: string, body: string): Promise<WorkspaceNote[]> {
  const sql = await db();
  await ensureWorkspace(sql);
  const note: WorkspaceNote = {
    id: `note_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    title: title.slice(0, 120),
    body: body.slice(0, 4000),
    at: new Date().toISOString(),
  };
  return sql.begin(async (tx) => {
    await tx`
      insert into kismet.workspace (id, notes, notes_at)
      values (${userId}, ${tx.json([STARTER_NOTE])}, now())
      on conflict (id) do nothing
    `;
    const rows = await tx<Row[]>`
      select notes from kismet.workspace where id = ${userId} for update
    `;
    const notes = [note, ...notesOf(rows[0]?.notes)].slice(0, 100);
    await tx`
      update kismet.workspace
      set notes = ${tx.json(notes as never)}, notes_at = now()
      where id = ${userId}
    `;
    return notes;
  });
}

export async function removeWorkspaceNote(userId: string, id: string): Promise<WorkspaceNote[]> {
  const sql = await db();
  await ensureWorkspace(sql);
  return sql.begin(async (tx) => {
    await tx`
      insert into kismet.workspace (id, notes, notes_at)
      values (${userId}, ${tx.json([STARTER_NOTE])}, now())
      on conflict (id) do nothing
    `;
    const rows = await tx<Row[]>`
      select notes from kismet.workspace where id = ${userId} for update
    `;
    const notes = notesOf(rows[0]?.notes).filter((note) => note.id !== id);
    await tx`
      update kismet.workspace
      set notes = ${tx.json(notes as never)}, notes_at = now()
      where id = ${userId}
    `;
    return notes;
  });
}

const GRAPH_TYPES = new Set(["PRODUCT", "FEATURE", "DECISION", "CUSTOMER_PROBLEM", "GOAL", "EXPERIMENT"]);

/** Text the model can read when Slack and Jira are still empty. */
export async function workspaceBrief(userId: string | null): Promise<string> {
  if (!userId) return "";
  try {
    const [workspaceNotes, states] = await Promise.all([readWorkspaceNotes(userId), loadStates(userId)]);
    if (!workspaceNotes) return "";
    const notes = workspaceNotes
      .slice(0, 40)
      .map((note) => `- ${note.title}: ${note.body.replace(/\s+/g, " ").trim()}`)
      .join("\n");
    const graph = graphBrief(states.graph?.data);
    return [
      notes ? `Notes written in this Kismet workspace:\n${notes}` : "",
      graph ? `Product graph:\n${graph}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 8000);
  } catch {
    return "";
  }
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

interface Row {
  notes: unknown;
}
