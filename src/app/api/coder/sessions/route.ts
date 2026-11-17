import { coderRouteError, coderUser, messageFrom } from "@/lib/coder/routes";
import { startCoderSession } from "@/lib/coder/sessions";

export async function POST(request: Request) {
  const userId = await coderUser();
  if (userId instanceof Response) return userId;
  const message = messageFrom(await request.json().catch(() => null));
  if (!message) return Response.json({ error: "Message must be between 1 and 8000 characters." }, { status: 400 });
  try {
    const session = await startCoderSession(userId, message);
    return Response.json({ sessionId: session.sessionId, repo: session.repo });
  } catch (error) {
    return coderRouteError("start session", error);
  }
}
