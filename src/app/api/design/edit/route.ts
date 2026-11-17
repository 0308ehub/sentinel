import { errorStatus } from "@/lib/ai/orchestrate";
import { editScreen } from "@/lib/design/edit-screen";
import { screenFromClient, type Screen } from "@/lib/design/scene";

export const maxDuration = 60;

export async function POST(request: Request) {
  let prompt = "";
  let selectedId = "";
  let screen: Screen | null = null;
  try {
    const body = (await request.json()) as { prompt?: unknown; selectedId?: unknown; screen?: unknown };
    prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
    selectedId = typeof body.selectedId === "string" ? body.selectedId.trim().slice(0, 80) : "";
    screen = screenFromClient(body.screen);
  } catch {
    return Response.json({ error: "Send the screen and what should change." }, { status: 400 });
  }
  if (!prompt) return Response.json({ error: "Say what should change." }, { status: 400 });
  if (!screen) return Response.json({ error: "Import a screen first." }, { status: 400 });
  try {
    const edited = await editScreen(screen, prompt, selectedId);
    return Response.json(edited);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change the screen.";
    return Response.json({ error: message }, { status: errorStatus(error) });
  }
}
