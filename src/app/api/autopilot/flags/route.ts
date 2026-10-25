import { autopilotConfigured } from "@/lib/autopilot/db";
import { listFlags } from "@/lib/autopilot/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!autopilotConfigured()) return Response.json({ flags: [] });
  try {
    return Response.json({ flags: await listFlags() });
  } catch {
    return Response.json({ flags: [] });
  }
}
