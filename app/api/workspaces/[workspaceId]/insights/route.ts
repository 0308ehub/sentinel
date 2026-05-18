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

    const insights = await prisma.insight.findMany({
      where: { workspaceId },
      orderBy: { confidence: "desc" },
    });

    return Response.json(apiSuccess(insights));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
