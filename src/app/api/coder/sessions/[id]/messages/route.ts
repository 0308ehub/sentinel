import { coderRouteError, coderUser, messageFrom } from "@/lib/coder/routes";
import { sendCoderMessage } from "@/lib/coder/sessions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await coderUser();
  if (userId instanceof Response) return userId;
  const message = messageFrom(await request.json().catch(() => null));
  if (!message) return Response.json({ error: "Message must be between 1 and 8000 characters." }, { status: 400 });
  const { id } = await context.params;
  try {
    await sendCoderMessage(userId, id, message);
    return Response.json({ ok: true });
  } catch (error) {
    return coderRouteError("send message", error);
  }
}
