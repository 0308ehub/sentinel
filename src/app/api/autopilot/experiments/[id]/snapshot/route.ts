import { withAutopilotUser } from "@/lib/autopilot/scope";
import {
  followSnapshots,
  snapshotFor,
  snapshotSource,
  SnapshotError,
  startSnapshot,
} from "@/lib/autopilot/snapshots";
import { getExperiment } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

function responseFor(snapshot: Awaited<ReturnType<typeof snapshotFor>>) {
  if (!snapshot) return { status: "none" as const };
  return {
    status: snapshot.status,
    scenario: snapshot.scenario,
    error: snapshot.error,
    controlHtml: snapshot.controlHtml,
    treatmentHtml: snapshot.treatmentHtml,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    await followSnapshots();
    const source = await snapshotSource(experiment);
    if (!source) return Response.json({ status: "none" });
    return Response.json(responseFor(await snapshotFor(id, source.sha)));
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return new Response("Sign in required.", { status: 401 });
  const { id } = await params;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return new Response("Experiment not found.", { status: 404 });
    if (!experiment.changeSummary) return new Response("The change summary is not ready yet.", { status: 409 });
    try {
      return Response.json(responseFor(await startSnapshot(experiment, experiment.changeSummary)));
    } catch (error) {
      if (error instanceof SnapshotError) return new Response(error.message, { status: error.status });
      console.error("[autopilot] snapshot start", error);
      return new Response("Could not start the sample preview.", { status: 500 });
    }
  });
}
