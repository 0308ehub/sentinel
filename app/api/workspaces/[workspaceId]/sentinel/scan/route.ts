import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { scanAllConnectors } from "@/server/services/autonomous-pm";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    const result = await scanAllConnectors(workspaceId);
    return Response.json(apiSuccess(result));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed";
    return Response.json(apiError("INTERNAL_ERROR", msg), { status: 500 });
  }
}
