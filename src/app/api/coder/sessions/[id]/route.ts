import { coderRouteError, coderUser } from "@/lib/coder/routes";
import { coderSessionView } from "@/lib/coder/sessions";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await coderUser();
  if (userId instanceof Response) return userId;
  const { id } = await context.params;
  try {
    return Response.json(await coderSessionView(userId, id));
  } catch (error) {
    return coderRouteError("get session", error);
  }
}
