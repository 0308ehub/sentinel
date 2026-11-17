import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { createPod } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { title?: string; agentIds?: string[] };
  try {
    const threadId = await createPod(userId, body.title ?? "", body.agentIds ?? []);
    return Response.json({ threadId });
  } catch (error) {
    return inboxFailure(error);
  }
}
