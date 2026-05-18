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
    const tickets = await prisma.engineeringTicket.findMany({
      where: { workspaceId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        opportunity: { select: { title: true } },
        prd: { select: { title: true } },
      },
    });
    return Response.json(apiSuccess(tickets));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
