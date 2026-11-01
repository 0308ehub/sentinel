import { currentUserId } from "@/lib/connections/current";
import { deleteConnection } from "@/lib/connections/store";
import { deleteSlackMentionState } from "@/lib/slack/mentions";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  await deleteSlackMentionState(userId);
  await deleteConnection(userId, "slack");
  return Response.json({ ok: true });
}
