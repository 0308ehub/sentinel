import "server-only";

import { designSignal } from "@/lib/autopilot/design";
import { claim, release } from "@/lib/autopilot/notify";
import { listExperiments, listSignals, log } from "@/lib/autopilot/store";

const ACTIVE = new Set(["building", "awaiting_approval", "queued", "running", "awaiting_rollout", "rolling_out"]);

export type SlackSignalStart =
  | { status: "started"; title: string }
  | { status: "already"; title: string };

/** Starts an open idea for the account currently selected by withAutopilotUser. */
export async function startSignalFromSlack(signalId: string, slackUserId: string): Promise<SlackSignalStart> {
  const [signals, experiments] = await Promise.all([listSignals(), listExperiments()]);
  const signal = signals.find((item) => item.id === signalId);
  if (!signal || signal.status !== "open" || signal.kind !== "idea") {
    return { status: "already", title: signal?.title ?? "this idea" };
  }
  if (experiments.some((item) => item.signalId === signalId && ACTIVE.has(item.status))) {
    return { status: "already", title: signal.title };
  }
  // One start per idea: the button and "yes" replies can arrive together, so take the lock before designing.
  if (!(await claim(`try_started:${signalId}`))) return { status: "already", title: signal.title };
  try {
    await designSignal(signalId, undefined, null);
  } catch (error) {
    await release(`try_started:${signalId}`);
    throw error;
  }
  await log("design", `Started “${signal.title}” from Slack at <@${slackUserId}>'s request.`, signalId);
  return { status: "started", title: signal.title };
}
