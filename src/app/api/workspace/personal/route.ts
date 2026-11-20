import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/autopilot/db";
import { siteAutopilotUser } from "@/lib/autopilot/scope";
import { PERSONAL_STATE_KEYS } from "@/lib/workspace/keys";
import { clearableTables } from "@/lib/workspace/move-in-core";

const LIVE_WORKSPACE_ERROR = "This is the live Kismet workspace for this deployment. Move it into your organization first.";

export async function DELETE(request: Request) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return Response.json({ error: "Clerk is not configured." }, { status: 400 });
  }
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || (body as { confirm?: unknown }).confirm !== "clear") {
    return Response.json({ error: 'Type "clear" to confirm.' }, { status: 400 });
  }
  if (await siteAutopilotUser() === userId) {
    return Response.json({ error: LIVE_WORKSPACE_ERROR }, { status: 409 });
  }

  const sql = await db();
  const counts = await sql.begin(async (tx) => {
    const removed: Record<string, number> = {};
    for (const entry of clearableTables()) {
      const personalState = entry.table === "workspace_state"
        ? ` and key not in (${PERSONAL_STATE_KEYS.map((key) => `'${key}'`).join(", ")})`
        : "";
      const result = await tx.unsafe(
        `delete from kismet.${entry.table} where user_id = $1${personalState}`,
        [userId],
      );
      removed[entry.table] = result.count;
    }
    const workspace = await tx.unsafe("delete from kismet.workspace where id = $1", [userId]);
    removed.workspace = workspace.count;
    return removed;
  });
  return Response.json({ counts });
}
