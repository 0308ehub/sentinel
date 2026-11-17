import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { reorderPins } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  try {
    await reorderPins(userId, Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : []);
    return Response.json({ ok: true });
  } catch (error) {
    return inboxFailure(error);
  }
}
