import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { actOnFinding } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

const ACTIONS = ["approve", "snooze", "dismiss", "never"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; tz?: number };
  const action = ACTIONS.find((item) => item === body.action);
  if (!action) return Response.json({ error: "Unknown action." }, { status: 400 });
  try {
    await actOnFinding(userId, id, action, body.tz);
    return Response.json({ ok: true });
  } catch (error) {
    return inboxFailure(error);
  }
}
