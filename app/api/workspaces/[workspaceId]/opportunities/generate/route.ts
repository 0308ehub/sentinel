import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generateOpportunities } from "@/server/services/opportunity-service";
import { apiSuccess, apiError } from "@/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    const opportunities = await generateOpportunities(workspaceId);
    return Response.json(apiSuccess(opportunities));
  } catch (error) {
    console.error("[generate-opportunities]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to generate opportunities"), { status: 500 });
  }
}
