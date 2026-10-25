import { approveCleanup, dismissCleanup } from "@/lib/autopilot/cleanup";
import { approve, reject, rollout, stop } from "@/lib/autopilot/lifecycle";
import { getExperiment } from "@/lib/autopilot/store";
import { GitHubApiError } from "@/lib/github/client";

export const dynamic = "force-dynamic";

const ACTIONS = ["approve", "reject", "rollout", "stop", "approve-cleanup", "dismiss-cleanup"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = ACTIONS.find((a) => a === body.action) as Action | undefined;
  if (!action) return Response.json({ error: "Unknown action." }, { status: 400 });

  const experiment = await getExperiment(id);
  if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });

  try {
    let message: string;
    if (action === "approve") message = await approve(experiment);
    else if (action === "reject") message = await reject(experiment);
    else if (action === "rollout") message = await rollout(experiment);
    else if (action === "approve-cleanup") message = await approveCleanup(experiment);
    else if (action === "dismiss-cleanup") message = await dismissCleanup(experiment);
    else {
      await stop(experiment, "Turned off by you.", false);
      message = "Turned off. Everyone sees the current version.";
    }
    return Response.json({ message });
  } catch (error) {
    const message =
      error instanceof GitHubApiError ? error.hint ?? error.message : error instanceof Error ? error.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 400 });
  }
}
