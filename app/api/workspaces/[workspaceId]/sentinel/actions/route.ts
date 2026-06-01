import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

    const where = {
      workspaceId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    };

    const [actions, total] = await Promise.all([
      prisma.sentinelAction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.sentinelAction.count({ where }),
    ]);

    return Response.json(apiSuccess({ actions, total }));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
