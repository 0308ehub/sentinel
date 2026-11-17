import { coderRouteError, coderUser } from "@/lib/coder/routes";
import { confirmCoderTool } from "@/lib/coder/sessions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await coderUser();
  if (userId instanceof Response) return userId;
  const body = (await request.json().catch(() => null)) as { toolUseId?: unknown; allow?: unknown } | null;
  if (typeof body?.toolUseId !== "string" || typeof body.allow !== "boolean") {
    return Response.json({ error: "Choose whether to allow this step." }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    await confirmCoderTool(userId, id, body.toolUseId, body.allow);
    return Response.json({ ok: true });
  } catch (error) {
    return coderRouteError("confirm tool", error);
  }
}
