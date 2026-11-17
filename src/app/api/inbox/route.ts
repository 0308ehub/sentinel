import { tzFrom, inboxFailure, inboxUser } from "@/lib/inbox/http";
import { listInbox } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json(await listInbox(userId, tzFrom(request)));
  } catch (error) {
    return inboxFailure(error);
  }
}
