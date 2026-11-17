import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { noteWork } from "@/lib/inbox/store";
import type { WorkKind } from "@/lib/inbox/score";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { kind?: WorkKind; tz?: number };
  const kind: WorkKind = body.kind === "reply" || body.kind === "card" || body.kind === "edit" ? body.kind : "page";
  try {
    await noteWork(userId, kind, body.tz);
    return Response.json({ ok: true });
  } catch (error) {
    return inboxFailure(error);
  }
}
