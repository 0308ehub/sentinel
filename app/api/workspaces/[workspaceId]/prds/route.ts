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
    const prds = await prisma.pRD.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { opportunity: { select: { title: true } }, _count: { select: { tickets: true } } },
    });
    return Response.json(apiSuccess(prds));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
