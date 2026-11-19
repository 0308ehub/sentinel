import { buildAutopilotMap } from "@/lib/autopilot/map-core";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { listExperiments, listGoals, listSignals } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json(await withAutopilotUser(userId, async () => {
      const [signals, experiments, goals] = await Promise.all([listSignals(), listExperiments(), listGoals()]);
      return buildAutopilotMap({ signals, experiments, goals });
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kismet could not load the map.";
    return Response.json({ error: message }, { status: 500 });
  }
}
