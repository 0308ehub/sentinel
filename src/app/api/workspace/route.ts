import { currentUserId } from "@/lib/connections/current";
import { autopilotConfigured } from "@/lib/autopilot/db";
import {
  addWorkspaceNote,
  readWorkspaceNotes,
  removeWorkspaceNote,
} from "@/lib/workspace/cloud";

export const maxDuration = 30;

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!autopilotConfigured()) return Response.json({ configured: false });
  try {
    const notes = await readWorkspaceNotes(userId);
    return Response.json({ configured: true, notes });
  } catch (error) {
    console.error("[workspace]", error);
    return Response.json({ error: "The notes could not be read." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!autopilotConfigured()) return Response.json({ error: "Add the Supabase connection string." }, { status: 503 });
  let body: {
    kind?: string;
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
    if (body.kind === "note") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!title || !text) return Response.json({ error: "Write a title and a note." }, { status: 400 });
      const notes = await addWorkspaceNote(userId, title, text);
      return Response.json({ notes });
    }
    if (body.kind === "remove-note") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return Response.json({ error: "Say which note to remove." }, { status: 400 });
      const notes = await removeWorkspaceNote(userId, id);
      return Response.json({ notes });
    }
    return Response.json({ error: "Unknown workspace update." }, { status: 400 });
  } catch (error) {
    console.error("[workspace]", error);
    return Response.json({ error: "The note could not be saved." }, { status: 503 });
  }
}
