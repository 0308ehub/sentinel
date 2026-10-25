import { autopilotConfigured } from "@/lib/autopilot/db";
import { addEvents, type NewEvent } from "@/lib/autopilot/store";
import type { Arm } from "@/lib/autopilot/assign";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 50;

function cleanArms(value: unknown): Record<string, Arm> {
  const arms: Record<string, Arm> = {};
  if (!value || typeof value !== "object") return arms;
  for (const [key, arm] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (/^[a-z0-9-]{1,80}$/.test(key) && (arm === "control" || arm === "treatment")) arms[key] = arm;
  }
  return arms;
}

export async function POST(request: Request) {
  if (!autopilotConfigured()) return new Response(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as { visitor?: unknown; events?: unknown } | null;
  const visitor = typeof body?.visitor === "string" ? body.visitor : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(visitor) || !Array.isArray(body?.events)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const events: NewEvent[] = [];
  for (const raw of body.events.slice(0, MAX_EVENTS) as Record<string, unknown>[]) {
    if (raw?.name !== "view" && raw?.name !== "click") continue;
    events.push({
      visitor,
      name: raw.name,
      page: typeof raw.page === "string" ? raw.page : "",
      element: typeof raw.element === "string" ? raw.element : "",
      arms: cleanArms(raw.arms),
      synthetic: false,
    });
  }
  try {
    await addEvents(events);
  } catch (error) {
    console.error("[autopilot] events", error);
  }
  return new Response(null, { status: 204 });
}
