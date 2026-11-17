import { withAutopilotUser } from "@/lib/autopilot/scope";
import { getExperiment } from "@/lib/autopilot/store";
import { managedSessionView } from "@/lib/coder/sessions";
import { currentUserId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

/** The live transcript of the coding agent building this experiment. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  try {
    const view = await withAutopilotUser(userId, async () => {
      const experiment = await getExperiment(id);
      if (!experiment?.coderSessionId) return null;
      return managedSessionView(experiment.coderSessionId);
    });
    if (!view) return Response.json({ error: "This experiment has no coding session." }, { status: 404 });
    return Response.json(view);
  } catch (error) {
    console.error("[autopilot] build session", error);
    return Response.json({ error: "Could not load the coding session." }, { status: 500 });
  }
}
