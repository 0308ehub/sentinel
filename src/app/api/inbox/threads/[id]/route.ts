import { inboxFailure, inboxUser, tzFrom } from "@/lib/inbox/http";
import { deleteThread, pinThread, sendMessage, threadMessages } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  try {
    return Response.json({ messages: await threadMessages(userId, id) });
  } catch (error) {
    return inboxFailure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { body?: string; replyTo?: string; tz?: number };
  try {
    await sendMessage(userId, id, body.body ?? "", body.replyTo, body.tz ?? tzFrom(request));
    return Response.json({ messages: await threadMessages(userId, id) });
  } catch (error) {
    return inboxFailure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { pinned?: boolean };
  try {
    await pinThread(userId, id, Boolean(body.pinned));
    return Response.json({ ok: true });
  } catch (error) {
    return inboxFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await inboxUser();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  try {
    await deleteThread(userId, id);
    return Response.json({ ok: true });
  } catch (error) {
    return inboxFailure(error);
  }
}
