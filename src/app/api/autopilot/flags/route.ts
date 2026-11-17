import { autopilotConfigured } from "@/lib/autopilot/db";
import { siteAutopilotUser, withAutopilotUser } from "@/lib/autopilot/scope";
import { listFlags } from "@/lib/autopilot/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = siteAutopilotUser();
  if (!autopilotConfigured() || !userId) return Response.json({ flags: [] });
  try {
    const flags = await withAutopilotUser(userId, () => listFlags());
    return Response.json({ flags: flags.filter((flag) => flag.status === "running" || flag.status === "rolled_out") });
  } catch {
    return Response.json({ flags: [] });
  }
}
