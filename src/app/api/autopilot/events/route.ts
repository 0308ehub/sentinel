import { autopilotConfigured } from "@/lib/autopilot/db";
import { siteAutopilotUser, withAutopilotUser } from "@/lib/autopilot/scope";
import { addEvents, type NewEvent } from "@/lib/autopilot/store";
import type { Arm } from "@/lib/autopilot/assign";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 50;
const WINDOW_MS = 60_000;
const MAX_POSTS = 30;
const posts = new Map<string, { count: number; reset: number }>();

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function allowedRate(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = posts.get(ip);
  if (!current || current.reset < now) {
    if (posts.size > 5000) posts.clear();
    posts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_POSTS;
}

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
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!allowedRate(request)) return Response.json({ error: "slow_down" }, { status: 429 });
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
      page: typeof raw.page === "string" ? raw.page.slice(0, 200) : "",
      element: typeof raw.element === "string" ? raw.element.slice(0, 80) : "",
      arms: cleanArms(raw.arms),
      synthetic: false,
    });
  }
  const userId = siteAutopilotUser();
  if (!userId) return new Response(null, { status: 204 });
  try {
    await withAutopilotUser(userId, () => addEvents(events));
  } catch (error) {
    console.error("[autopilot] events", error);
  }
  return new Response(null, { status: 204 });
}
