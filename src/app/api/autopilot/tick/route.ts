import { timingSafeEqual } from "node:crypto";
import { runTick } from "@/lib/autopilot/loop";
import { tickUsers } from "@/lib/autopilot/scope";
import { currentAccountId } from "@/lib/connections/current";
import { listConnectionUsers } from "@/lib/connections/store";

function bearerMatches(header: string | null, secret: string): boolean {
  const got = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel cron calls GET with the CRON_SECRET bearer and runs every GitHub-connected account.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && !bearerMatches(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const connected = await listConnectionUsers("github").catch((error) => {
    console.error("[autopilot] connected users", error);
    return [];
  });
  const users = tickUsers(connected, await currentAccountId());
  const runs = [];
  for (const userId of users) runs.push(await runTick(userId));
  return Response.json({ ran: runs.some((run) => run.ran), runs });
}

// The Run now button runs only the signed-in account.
export async function POST() {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json(await runTick(userId));
}
