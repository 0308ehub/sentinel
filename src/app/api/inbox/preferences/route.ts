import { inboxFailure, inboxUser } from "@/lib/inbox/http";
import { readPrefs, writePrefs, type InboxPrefs } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json({ prefs: await readPrefs(userId), slackAvailable: process.env.INBOX_SLACK === "1" });
  } catch (error) {
    return inboxFailure(error);
  }
}

export async function PUT(request: Request) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Partial<InboxPrefs> & {
    weights?: { type: string; autonomy?: string }[];
    muted?: { id: string; muted: boolean }[];
  };
  try {
    return Response.json({ prefs: await writePrefs(userId, body), slackAvailable: process.env.INBOX_SLACK === "1" });
  } catch (error) {
    return inboxFailure(error);
  }
}
