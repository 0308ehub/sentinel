import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const { queueAction } = await import("@/server/services/autonomous-pm");
    const action = await queueAction({
      workspaceId,
      type: "GENERATE_DIGEST",
      title: "Generate weekly PM digest",
      description: "Compile a weekly digest of workspace activity, top pain points, opportunities, and ticket progress.",
      payload: {},
      triggeredBy: "manual",
      autoApprove: true,
    });

    return Response.json(apiSuccess({ actionId: action.id }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to queue digest"), { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const lastDigest = await prisma.sentinelAction.findFirst({
      where: { workspaceId, type: "GENERATE_DIGEST", status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(apiSuccess({ action: lastDigest }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to fetch digest"), { status: 500 });
  }
}
