import { autopilotConfigured } from "@/lib/autopilot/db";
import { listFlags } from "@/lib/autopilot/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!autopilotConfigured()) return Response.json({ flags: [] });
  try {
    const flags = (await listFlags()).filter((flag) => flag.status === "running" || flag.status === "rolled_out");
    return Response.json({ flags });
  } catch {
    return Response.json({ flags: [] });
  }
}
