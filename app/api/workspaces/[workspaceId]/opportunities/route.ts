import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const opportunities = await prisma.opportunity.findMany({
      where: { workspaceId },
      orderBy: { totalScore: "desc" },
      include: {
        _count: { select: { prds: true, tickets: true } },
        painPoint: { select: { title: true } },
      },
    });

    return Response.json(apiSuccess(opportunities));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
