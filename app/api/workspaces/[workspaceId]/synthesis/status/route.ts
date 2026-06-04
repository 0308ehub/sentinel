import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { lastSynthesizedAt: true },
    });

    const [painPointCount, pendingDocCount, newDocCount] = await Promise.all([
      prisma.painPoint.count({ where: { workspaceId, status: "ACTIVE" } }),
      prisma.document.count({
        where: { workspaceId, status: { notIn: ["COMPLETED", "FAILED"] } },
      }),
      workspace?.lastSynthesizedAt
        ? prisma.document.count({
            where: {
              workspaceId,
              status: "COMPLETED",
              updatedAt: { gt: workspace.lastSynthesizedAt },
            },
          })
        : Promise.resolve(0),
    ]);

    return Response.json({
      lastSynthesizedAt: workspace?.lastSynthesizedAt ?? null,
      painPointCount,
      pendingDocCount,
      newDocsSinceLastSynthesis: newDocCount,
    });
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }
}
