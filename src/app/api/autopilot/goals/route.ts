import { parseMetricSpec } from "@/lib/autopilot/assign";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { addGoal, archiveGoal, listGoals } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";

async function user(): Promise<string | null> {
  return currentUserId();
}

export async function GET() {
  const userId = await user();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ goals: await withAutopilotUser(userId, listGoals) });
}

export async function POST(request: Request) {
  const userId = await user();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: unknown; metric?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const spec = parseMetricSpec(body?.metric);
  if (!name || name.length > 60 || !spec) return Response.json({ error: "Provide a name up to 60 characters and a valid metric." }, { status: 400 });
  const id = await withAutopilotUser(userId, () => addGoal({ name, spec, source: "person" }));
  if (!id) return Response.json({ error: "You can have up to five active goals." }, { status: 409 });
  return Response.json({ id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await user();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return Response.json({ error: "Goal id required." }, { status: 400 });
  const archived = await withAutopilotUser(userId, () => archiveGoal(body.id as string));
  return archived ? Response.json({ archived: true }) : Response.json({ error: "Goal not found." }, { status: 404 });
}
