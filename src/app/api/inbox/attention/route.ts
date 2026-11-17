import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { attentionCount } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await inboxUser();
  if (!userId) return Response.json({ count: 0 });
  try {
    return Response.json({ count: await attentionCount(userId) });
  } catch (error) {
    return inboxFailure(error);
  }
}
