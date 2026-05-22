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

    const summaries = await prisma.productEvent.findMany({
      where: {
        workspaceId,
        event: "EXECUTIVE_SUMMARY",
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(apiSuccess(summaries));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
