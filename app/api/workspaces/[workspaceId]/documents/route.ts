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

    const documents = await prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { extractions: true, chunks: true } },
        uploadedBy: { select: { name: true, email: true } },
      },
    });

    return Response.json(apiSuccess(documents));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
