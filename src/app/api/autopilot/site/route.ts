import { withAutopilotUser } from "@/lib/autopilot/scope";
import { rotateSiteKey, setSiteUrl, siteDetailsFor } from "@/lib/autopilot/sites";
import { eventsSince } from "@/lib/autopilot/store";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

// The script is served by whichever deployment the account uses (production, a preview, or local dev).
function snippetFor(key: string, origin: string): string {
  return `<script async src="${origin}/kismet.js" data-site="${key}"></script>`;
}

export async function GET(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const [key, recentEvents] = await Promise.all([
      siteDetailsFor(userId),
      withAutopilotUser(userId, () => eventsSince(24)),
    ]);
    return Response.json({ key: key.key, siteUrl: key.siteUrl, snippet: snippetFor(key.key, new URL(request.url).origin), eventsLast24h: recentEvents });
  } catch (error) {
    console.error("[autopilot] site", error);
    return Response.json({ error: "Could not load the site SDK." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: unknown; siteUrl?: unknown } | null;
  if (body?.action === "site_url") {
    if (typeof body.siteUrl !== "string") return Response.json({ error: "Enter a valid HTTPS URL." }, { status: 400 });
    try {
      const url = new URL(body.siteUrl.trim());
      if (url.protocol !== "https:") throw new Error("protocol");
      const siteUrl = url.toString().replace(/\/$/, "");
      await setSiteUrl(userId, siteUrl);
      return Response.json({ siteUrl });
    } catch {
      return Response.json({ error: "Enter a valid HTTPS URL." }, { status: 400 });
    }
  }
  if (body?.action !== "rotate") return Response.json({ error: "Unknown action." }, { status: 400 });
  try {
    const key = await rotateSiteKey(userId);
    return Response.json({ key, snippet: snippetFor(key, new URL(request.url).origin) });
  } catch (error) {
    console.error("[autopilot] site rotate", error);
    return Response.json({ error: "Could not rotate the site key." }, { status: 500 });
  }
}
