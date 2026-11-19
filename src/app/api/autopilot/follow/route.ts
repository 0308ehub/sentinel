import { timingSafeEqual } from "node:crypto";

import { followAgentBuilds } from "@/lib/autopilot/agent-build";
import { followDispatchBuilds } from "@/lib/autopilot/dispatch-build";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { listExperiments, withTickLock } from "@/lib/autopilot/store";
import { hasUnsortedEvidenceSince, lastRunAt } from "@/lib/autopilot/store";
import { runTick } from "@/lib/autopilot/loop";
import { tickTriggerDue } from "@/lib/autopilot/tick-trigger-core";
import { sourceLabel } from "@/lib/autopilot/source";
import { postAccountAlert } from "@/lib/autopilot/notify";
import { postThreadUpdates } from "@/lib/autopilot/thread-updates";
import { getConnection, listConnectionUsers } from "@/lib/connections/store";

function bearerMatches(header: string | null, secret: string): boolean {
  const encoder = new TextEncoder();
  const got = encoder.encode(header ?? "");
  const expected = encoder.encode(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function hasActiveBuild(): Promise<boolean> {
  return (await listExperiments()).some(
    (experiment) => experiment.status === "building" && Boolean(experiment.coderSessionId || experiment.buildRef),
  );
}

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && !bearerMatches(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const users = await listConnectionUsers("github").catch((error) => {
    console.error("[autopilot] follow connected users", error);
    return [];
  });
  let checked = 0;
  let ran = 0;
  for (const userId of [...new Set(users)]) {
    if (await getConnection(userId, "slack").catch(() => null)) {
      await withAutopilotUser(userId, async () => {
        try {
          await postThreadUpdates();
        } catch (error) {
          console.error("[autopilot] could not post reporter thread updates", error);
        }
      });
    }
    await withAutopilotUser(userId, async () => {
      try {
        if (!(await sourceLabel())) return;
        const last = await lastRunAt();
        if (last && Date.now() - Date.parse(last) <= 150 * 60_000) return;
        const when = last ? new Date(last).toISOString() : "never";
        await postAccountAlert(`tick_missing:${last ? new Date(last).toISOString() : "null"}`, `Kismet hasn't run since ${when} UTC. The hourly job may be down.`);
      } catch (error) {
        console.error("[autopilot] could not check missed runs", error);
      }
    });
    // A Slack message that arrived while a run was finishing would otherwise wait for the next hourly run.
    const caughtUp = await withAutopilotUser(userId, async () => {
      try {
        if (!(await sourceLabel())) return false;
        const last = await lastRunAt();
        if (!tickTriggerDue(last, new Date()) || !(await hasUnsortedEvidenceSince(last))) return false;
        return (await runTick(userId)).ran;
      } catch (error) {
        console.error("[autopilot] could not run for new evidence", error);
        return false;
      }
    });
    if (caughtUp) {
      ran += 1;
      continue;
    }
    // Check without the lock first, so an idle account never holds it and blocks the hourly run.
    const didCheck = await withAutopilotUser(userId, async () => {
      if (!(await hasActiveBuild())) return false;
      return withTickLock(async () => {
        if (!(await hasActiveBuild())) return false;
        await followAgentBuilds();
        await followDispatchBuilds();
        return true;
      });
    });
    if (didCheck) checked += 1;
  }
  return Response.json({ checked, ran, users: users.length });
}
