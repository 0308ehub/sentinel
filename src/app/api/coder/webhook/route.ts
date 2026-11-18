import { db } from "@/lib/autopilot/db";
import { followAgentBuilds } from "@/lib/autopilot/agent-build";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { experimentOwnerBySession } from "@/lib/autopilot/store";
import { followSnapshots, snapshotOwnerBySession } from "@/lib/autopilot/snapshots";
import { client } from "@/lib/coder/sessions";

async function firstReceipt(id: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql<{ id: string }[]>`
    insert into kismet.webhook_events (id) values (${id})
    on conflict do nothing returning id
  `;
  return rows.length > 0;
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_WEBHOOK_SIGNING_KEY?.trim();
  if (!key) return new Response(null, { status: 503 });
  const body = await request.text();
  let event;
  try {
    event = client().beta.webhooks.unwrap(body, { headers: Object.fromEntries(request.headers), key });
  } catch {
    console.warn("[coder] webhook rejected: bad signature");
    return new Response(null, { status: 400 });
  }
  console.info(`[coder] webhook ${event.data.type} ${event.data.id}`);
  try {
    if (!await firstReceipt(event.id)) return new Response(null, { status: 204 });
    if (event.data.type !== "session.status_idled" && event.data.type !== "session.status_terminated") {
      return new Response(null, { status: 204 });
    }
    const buildOwner = await experimentOwnerBySession(event.data.id);
    if (buildOwner) await withAutopilotUser(buildOwner, followAgentBuilds);
    const snapshotOwner = await snapshotOwnerBySession(event.data.id);
    if (snapshotOwner) await withAutopilotUser(snapshotOwner, followSnapshots);
  } catch (error) {
    console.error("[coder] webhook", error);
  }
  return new Response(null, { status: 204 });
}
