import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { synthesizeWorkspace } from "@/server/services/synthesis-service";
import { apiSuccess, apiError } from "@/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const result = await synthesizeWorkspace(workspaceId);
    return Response.json(apiSuccess(result));
  } catch (error) {
    console.error("[synthesize]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Synthesis failed"), { status: 500 });
  }
}
