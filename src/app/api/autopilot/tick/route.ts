import { runTick } from "@/lib/autopilot/loop";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel cron calls GET with the CRON_SECRET bearer; the Run now button calls POST.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runTick());
}

export async function POST() {
  return Response.json(await runTick());
}
