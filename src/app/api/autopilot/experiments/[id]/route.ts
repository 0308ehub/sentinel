import { cancelBuild } from "@/lib/autopilot/agent-build";
import { foldActivity } from "@/lib/autopilot/activity-core";
import { approveCleanup, dismissCleanup } from "@/lib/autopilot/cleanup";
import { approve, reject, rollout, scheduleRollout, stop } from "@/lib/autopilot/lifecycle";
import type { RolloutPhase } from "@/lib/autopilot/rollout-plan";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { srmCheck } from "@/lib/autopilot/stats";
import { experimentActivity, getExperiment, listFlags, log, updateExperiment } from "@/lib/autopilot/store";
import { currentAccountId } from "@/lib/connections/current";
import { GitHubApiError } from "@/lib/github/client";
import { attributed, currentPersonName } from "@/lib/auth/person";

export const dynamic = "force-dynamic";

const ACTIONS = ["approve", "reject", "cancel", "rollout", "schedule", "stop", "approve-cleanup", "dismiss-cleanup"] as const;
type Action = (typeof ACTIONS)[number];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    if (!experiment.startedAt) return Response.json({ series: [], activity: null });
    const [counted, flags] = await Promise.all([
      experimentActivity(experiment.flag, experiment.startedAt, experiment.metricSpec),
      listFlags(),
    ]);
    const treatmentPct = flags.find((flag) => flag.key === experiment.flag)?.treatmentPct ?? 50;
    const mix = { human: counted.human, synthetic: counted.synthetic };
    const drafted = foldActivity(counted.rows, mix, treatmentPct);
    const visitors = drafted.totals.control.visitors + drafted.totals.treatment.visitors;
    const split = srmCheck(drafted.totals.control.visitors, drafted.totals.treatment.visitors, treatmentPct / 100);
    const activity = foldActivity(counted.rows, mix, treatmentPct, visitors >= 100 && split.pValue < 0.001);
    const byDay = new Map<string, { day: string; control: number; treatment: number }>();
    for (const point of activity.days) byDay.set(point.day, { day: point.day, control: point.control.visitors, treatment: point.treatment.visitors });
    return Response.json({ series: [...byDay.values()], activity });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { adjustments?: unknown };
  if (typeof body.adjustments !== "string") return Response.json({ error: "Notes must be text." }, { status: 400 });
  const requestedAdjustments = body.adjustments;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    if (experiment.buildStartedAt || experiment.coderSessionId || experiment.buildRef || experiment.draftPath || experiment.status !== "building") {
      return Response.json({ error: "Notes cannot be changed after building starts." }, { status: 409 });
    }
    const adjustments = requestedAdjustments.trim().slice(0, 2000) || null;
    await updateExperiment(id, { adjustments });
    await log("person", attributed(`Saved build notes for “${experiment.title}”`, await currentPersonName()), id);
    return Response.json({ adjustments });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; phases?: RolloutPhase[] };
  const action = ACTIONS.find((a) => a === body.action) as Action | undefined;
  if (!action) return Response.json({ error: "Unknown action." }, { status: 400 });

  const name = await currentPersonName();
  return withAutopilotUser(userId, () => act(id, action, body.phases, name));
}

async function act(id: string, action: Action, phases: RolloutPhase[] | undefined, name: string): Promise<Response> {
  const experiment = await getExperiment(id);
  if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });

  try {
    let message: string;
    if (action === "approve") message = await approve(experiment);
    else if (action === "reject" || action === "cancel") message = action === "cancel" ? await cancelBuild(experiment) : await reject(experiment);
    else if (action === "rollout") message = await rollout(experiment);
    else if (action === "schedule") message = await scheduleRollout(experiment, phases ?? []);
    else if (action === "approve-cleanup") message = await approveCleanup(experiment);
    else if (action === "dismiss-cleanup") message = await dismissCleanup(experiment);
    else {
      await stop(experiment, "Turned off by you.", false);
      message = "Turned off. Everyone sees the current version.";
    }
    if (["approve", "reject", "rollout", "approve-cleanup", "dismiss-cleanup"].includes(action)) {
      await log("person", attributed(`${action === "reject" ? "Declined" : action === "rollout" ? "Merged" : "Approved"} “${experiment.title}”`, name), id);
    }
    return Response.json({ message });
  } catch (error) {
    const message =
      error instanceof GitHubApiError ? error.hint ?? error.message : error instanceof Error ? error.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 400 });
  }
}
