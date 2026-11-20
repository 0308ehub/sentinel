import { ensureChangeSummary } from "@/lib/autopilot/change-summary-server";
import { chosenAutopilotRepo, defaultAutopilotRepo } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { siteUrlFor } from "@/lib/autopilot/sites";
import { getExperiment } from "@/lib/autopilot/store";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    const repo = await chosenAutopilotRepo();
    const siteUrl = repo === defaultAutopilotRepo() ? null : await siteUrlFor(userId);
    const summary = await ensureChangeSummary(experiment);
    return summary ? Response.json({ summary, siteUrl }) : Response.json({ pending: true, siteUrl });
  });
}
