import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

async function getParams(params: Promise<{ workspaceId: string; insightId: string }>) {
  return params;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; insightId: string }> }
) {
  try {
    const { workspaceId, insightId } = await getParams(params);
    await requireWorkspaceAccess(workspaceId);

    const body = await req.json();
    const { title, description, confidence } = body;

    const updated = await prisma.insight.update({
      where: { id: insightId, workspaceId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(confidence !== undefined && { confidence: Number(confidence) }),
      },
    });

    return Response.json(apiSuccess(updated));
  } catch (err) {
    console.error("[insight PATCH]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update insight"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; insightId: string }> }
) {
  try {
    const { workspaceId, insightId } = await getParams(params);
    await requireWorkspaceAccess(workspaceId);

    await prisma.insight.delete({ where: { id: insightId, workspaceId } });
    return Response.json(apiSuccess({ deleted: true }));
  } catch (err) {
    console.error("[insight DELETE]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to delete insight"), { status: 500 });
  }
}
