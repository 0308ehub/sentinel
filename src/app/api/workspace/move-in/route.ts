import { PERSONAL_STATE_KEYS } from "@/lib/workspace/keys";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/autopilot/db";
import { conflictPredicate, movableTables } from "@/lib/workspace/move-in-core";

function authorized(role: string | null | undefined): boolean {
  return role === "org:admin";
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return Response.json({ eligible: false });
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId || !authorized(orgRole)) return Response.json({ eligible: false });
  const sql = await db();
  const [personal] = await sql<{ has_data: boolean }[]>`
    select exists(
      select 1 from kismet.experiments where user_id = ${userId}
      union all select 1 from kismet.signals where user_id = ${userId}
      union all select 1 from kismet.connections where user_id = ${userId}
      union all select 1 from kismet.workspace_state where user_id = ${userId}
    ) as has_data`;
  const [workspace] = await sql<{ has_data: boolean }[]>`
    select exists(
      select 1 from kismet.experiments where user_id = ${orgId}
      union all select 1 from kismet.signals where user_id = ${orgId}
    ) as has_data`;
  const dismissed = await sql`select 1 from kismet.workspace_state where user_id = ${orgId} and key = 'move-in-dismissed' limit 1`;
  return Response.json({ eligible: Boolean(personal?.has_data) && !workspace?.has_data && dismissed.length === 0 });
}

export async function DELETE() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return Response.json({ ok: true });
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!orgId || !authorized(orgRole)) return Response.json({ error: "An organization admin is required." }, { status: 403 });
  const sql = await db();
  await sql`insert into kismet.workspace_state (user_id, key, data) values (${orgId}, 'move-in-dismissed', '{"dismissed":true}'::jsonb) on conflict (user_id, key) do update set data = excluded.data, updated_at = now()`;
  return Response.json({ ok: true });
}

export async function POST() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return Response.json({ error: "Organizations are not configured." }, { status: 400 });
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!orgId || !authorized(orgRole)) return Response.json({ error: "An organization admin is required." }, { status: 403 });
  const sql = await db();
  try {
    const counts = await sql.begin(async (tx) => {
      const occupied = await tx`select 1 from kismet.experiments where user_id = ${orgId} union all select 1 from kismet.signals where user_id = ${orgId} limit 1`;
      if (occupied.length) throw new Error("WORKSPACE_OCCUPIED");
      const moved: Record<string, number> = {};
      for (const entry of movableTables()) {
        const predicate = conflictPredicate(entry);
        const conflict = predicate
          ? ` and not exists (select 1 from kismet.${entry.table} target where target.user_id = $2 and ${predicate})`
          : "";
        // Chats and personal setup stay with the person, not the shared workspace.
        const personal = entry.table === "workspace_state"
          ? ` and source.key not in (${PERSONAL_STATE_KEYS.map((key) => `'${key}'`).join(", ")})`
          : "";
        const result = await tx.unsafe(
          `update kismet.${entry.table} source set user_id = $2 where source.user_id = $1${conflict}${personal}`,
          [userId, orgId],
        );
        moved[entry.table] = result.count;
      }
      await tx`insert into kismet.account_moves (from_id, to_id) values (${userId}, ${orgId}) on conflict (from_id) do update set to_id = excluded.to_id, moved_at = now()`;
      return moved;
    });
    return Response.json({ counts });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_OCCUPIED") {
      return Response.json({ error: "This workspace already has data." }, { status: 409 });
    }
    throw error;
  }
}
