import { currentUserId } from "@/lib/connections/current";
import { deleteConnection } from "@/lib/connections/store";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  await deleteConnection(userId, "jira");
  return Response.json({ connected: false });
}
