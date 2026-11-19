import { timingSafeEqual } from "node:crypto";

import { followAgentBuilds } from "@/lib/autopilot/agent-build";
import { followDispatchBuilds } from "@/lib/autopilot/dispatch-build";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { listExperiments, withTickLock } from "@/lib/autopilot/store";
import { listConnectionUsers } from "@/lib/connections/store";

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
  for (const userId of [...new Set(users)]) {
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
  return Response.json({ checked, users: users.length });
}
