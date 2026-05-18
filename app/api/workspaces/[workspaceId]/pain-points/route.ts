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

    const painPoints = await prisma.painPoint.findMany({
      where: { workspaceId },
      orderBy: [{ severity: "desc" }, { urgency: "desc" }],
    });

    return Response.json(apiSuccess(painPoints));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
