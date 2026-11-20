import { autopilotConfigured } from "@/lib/autopilot/db";
import { siteAutopilotUser, withAutopilotUser } from "@/lib/autopilot/scope";
import { userForSiteKey } from "@/lib/autopilot/sites";
import { addEvents, type NewEvent } from "@/lib/autopilot/store";
import { isBotUserAgent } from "@/lib/autopilot/traffic-core";
import { EVENT_NAME, type Arm } from "@/lib/autopilot/assign";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 50;
const VISITOR = /^[A-Za-z0-9-]{8,64}$/;
const FLAG = /^[a-z0-9-]{1,80}$/;
const WINDOW_MS = 60_000;
const MAX_POSTS = 30;
const MAX_KEY_POSTS = 120;
const posts = new Map<string, { count: number; reset: number }>();
const keyPosts = new Map<string, { count: number; reset: number }>();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function allowedCounter(values: Map<string, { count: number; reset: number }>, id: string, limit: number): boolean {
  const now = Date.now();
  const current = values.get(id);
  if (!current || current.reset < now) {
    if (values.size > 5000) values.clear();
    values.set(id, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function allowedRate(request: Request, key: string | null): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowedCounter(posts, ip, MAX_POSTS)) return false;
  return key === null || allowedCounter(keyPosts, key, MAX_KEY_POSTS);
}

function cleanArms(value: unknown): Record<string, Arm> {
  const arms: Record<string, Arm> = {};
  if (!value || typeof value !== "object") return arms;
  for (const [key, arm] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (FLAG.test(key) && (arm === "control" || arm === "treatment")) arms[key] = arm;
  }
  return arms;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { site?: unknown; visitor?: unknown; events?: unknown; automated?: unknown } | null;
  const key = typeof body?.site === "string" ? body.site : null;
  const headers = key === null ? undefined : CORS;
  if (!autopilotConfigured()) return new Response(null, { status: 204, headers });
  if (key === null && !sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!allowedRate(request, key)) return Response.json({ error: "slow_down" }, { status: 429, headers });
  let userId: string | null;
  try {
    userId = key === null ? await siteAutopilotUser() : await userForSiteKey(key);
  } catch (error) {
    console.error("[autopilot] events site", error);
    return new Response(null, { status: 204, headers });
  }
  if (!userId) return new Response(null, { status: 204, headers });
  const visitor = typeof body?.visitor === "string" ? body.visitor : "";
  if (!VISITOR.test(visitor) || !Array.isArray(body?.events)) {
    return Response.json({ error: "bad_request" }, { status: 400, headers });
  }
  const synthetic = body.automated === true || isBotUserAgent(request.headers.get("user-agent"));
  const events: NewEvent[] = [];
  for (const raw of body.events.slice(0, MAX_EVENTS) as Record<string, unknown>[]) {
    const name = raw?.name;
    if (name !== "view" && name !== "click" && name !== "track" && name !== "exposure") continue;
    const element = typeof raw.element === "string" ? raw.element.slice(0, 80) : "";
    if (name === "track" && !EVENT_NAME.test(element)) continue;
    if (name === "exposure" && !FLAG.test(element)) continue;
    // A server batches events from many visitors into one request.
    const own = typeof raw.visitor === "string" && VISITOR.test(raw.visitor) ? raw.visitor : visitor;
    events.push({
      visitor: own,
      name,
      page: typeof raw.page === "string" ? raw.page.slice(0, 200) : "",
      element,
      arms: cleanArms(raw.arms),
      synthetic,
    });
  }
  try {
    await withAutopilotUser(userId, () => addEvents(events));
  } catch (error) {
    console.error("[autopilot] events", error);
  }
  return new Response(null, { status: 204, headers });
}
