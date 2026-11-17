import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { updateAgent } from "@/lib/inbox/store";
import type { AgentPatch } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as AgentPatch;
  try {
    await updateAgent(userId, id, body);
    return Response.json({ ok: true });
  } catch (error) {
    return inboxFailure(error);
  }
}
