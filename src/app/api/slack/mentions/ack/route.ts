import { acknowledgeSlackInbox } from "@/lib/slack/mentions";

export async function POST(request: Request) {
  let ids: string[] = [];
  try {
    const body = (await request.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 30) : [];
  } catch {
    return Response.json({ error: "Send JSON with ids." }, { status: 400 });
  }
  await acknowledgeSlackInbox(ids);
  return Response.json({ ok: true });
}
