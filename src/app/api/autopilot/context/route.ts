import { randomUUID } from "node:crypto";
import { splitSetupContext } from "@/lib/autopilot/context";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { addEvidence } from "@/lib/autopilot/store";
import { currentAccountId } from "@/lib/connections/current";
import { addWorkspaceNote } from "@/lib/workspace/cloud";

export async function POST(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return Response.json({ error: "Send the context as JSON." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 20 || text.length > 8000) {
    return Response.json({ error: "Context must be between 20 and 8000 characters." }, { status: 400 });
  }

  try {
    const items = splitSetupContext(text);
    const contextId = randomUUID();
    const now = new Date().toISOString();
    await addWorkspaceNote(userId, "What I told Kismet at setup", text);
    const saved = await withAutopilotUser(userId, () => addEvidence(items.map((item, index) => ({
      source: "interview",
      synthetic: false,
      title: item.slice(0, 120),
      body: item,
      author: "You (setup)",
      url: `kismet://context/${contextId}/${index}`,
      occurredAt: now,
    }))));
    return Response.json({ saved });
  } catch (error) {
    console.error("[autopilot context]", error);
    return Response.json({ error: "The context could not be saved." }, { status: 503 });
  }
}
