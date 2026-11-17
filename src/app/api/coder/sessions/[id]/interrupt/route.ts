import { coderRouteError, coderUser } from "@/lib/coder/routes";
import { interruptCoderSession } from "@/lib/coder/sessions";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await coderUser();
  if (userId instanceof Response) return userId;
  const { id } = await context.params;
  try {
    await interruptCoderSession(userId, id);
    return Response.json({ ok: true });
  } catch (error) {
    return coderRouteError("interrupt session", error);
  }
}
