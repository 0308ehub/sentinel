import { autopilotConfigured } from "@/lib/autopilot/db";
import { siteAutopilotUser, withAutopilotUser } from "@/lib/autopilot/scope";
import { userForSiteKey } from "@/lib/autopilot/sites";
import { listFlags } from "@/lib/autopilot/store";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("site");
  const headers = key === null ? undefined : CORS;
  let userId: string | null;
  try {
    userId = key === null ? siteAutopilotUser() : await userForSiteKey(key);
  } catch (error) {
    console.error("[autopilot] flags site", error);
    return Response.json({ flags: [] }, { headers });
  }
  if (!autopilotConfigured() || !userId) return Response.json({ flags: [] }, { headers });
  try {
    const flags = await withAutopilotUser(userId, () => listFlags());
    return Response.json(
      { flags: flags.filter((flag) => flag.status === "running" || flag.status === "rolled_out") },
      { headers }
    );
  } catch (error) {
    console.error("[autopilot] flags", error);
    return Response.json({ flags: [] }, { headers });
  }
}
