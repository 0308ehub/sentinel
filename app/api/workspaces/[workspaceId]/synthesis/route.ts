import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const [painPoints, insights, opportunities] = await Promise.all([
      prisma.painPoint.deleteMany({ where: { workspaceId } }),
      prisma.insight.deleteMany({ where: { workspaceId } }),
      prisma.opportunity.deleteMany({ where: { workspaceId } }),
    ]);

    return Response.json(
      apiSuccess({
        deleted: {
          painPoints: painPoints.count,
          insights: insights.count,
          opportunities: opportunities.count,
        },
      })
    );
  } catch (err) {
    console.error("[synthesis DELETE]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to clear synthesis"), { status: 500 });
  }
}
