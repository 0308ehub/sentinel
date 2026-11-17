import { currentUserId } from "@/lib/connections/current";
import { autopilotConfigured } from "@/lib/autopilot/db";
import {
  addWorkspaceNote,
  readWorkspace,
  removeWorkspaceNote,
  saveWorkspacePart,
} from "@/lib/workspace/cloud";

export const maxDuration = 30;

export async function GET() {
  const denied = await signedIn();
  if (denied) return denied;
  if (!autopilotConfigured()) return Response.json({ configured: false });
  try {
    const workspace = await readWorkspace();
    return Response.json({ configured: true, ...workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workspace could not be read.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await signedIn();
  if (denied) return denied;
  if (!autopilotConfigured()) return Response.json({ error: "Add the Supabase connection string." }, { status: 503 });
  let body: {
    kind?: string;
    at?: string | null;
    graph?: unknown;
    chat?: unknown;
    title?: string;
    text?: string;
    id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Send the workspace update as JSON." }, { status: 400 });
  }

  try {
    if (body.kind === "graph" || body.kind === "chat") {
      const payload = body.kind === "graph" ? body.graph : body.chat;
      if (!payload || typeof payload !== "object") return Response.json({ error: "Send the saved workspace." }, { status: 400 });
      if (JSON.stringify(payload).length > 1_500_000) {
        return Response.json({ error: "That workspace is too large to save." }, { status: 413 });
      }
      const saved = await saveWorkspacePart(body.kind, payload, typeof body.at === "string" ? body.at : null);
      if ("conflict" in saved) {
        const workspace = await readWorkspace();
        return Response.json({ error: "The workspace changed on another screen.", ...workspace }, { status: 409 });
      }
      return Response.json({ ok: true, at: saved.at });
    }
    if (body.kind === "note") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!title || !text) return Response.json({ error: "Write a title and a note." }, { status: 400 });
      const notes = await addWorkspaceNote(title, text);
      return Response.json({ notes });
    }
    if (body.kind === "remove-note") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return Response.json({ error: "Say which note to remove." }, { status: 400 });
      const notes = await removeWorkspaceNote(id);
      return Response.json({ notes });
    }
    return Response.json({ error: "Unknown workspace update." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workspace could not be saved.";
    return Response.json({ error: message }, { status: 503 });
  }
}

async function signedIn(): Promise<Response | null> {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  return null;
}
