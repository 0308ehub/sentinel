import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

async function getParams(params: Promise<{ workspaceId: string; painPointId: string }>) {
  return params;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; painPointId: string }> }
) {
  try {
    const { workspaceId, painPointId } = await getParams(params);
    await requireWorkspaceAccess(workspaceId);

    const body = await req.json();
    const { title, description, severity, urgency, affectedSegments } = body;

    const updated = await prisma.painPoint.update({
      where: { id: painPointId, workspaceId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(severity !== undefined && { severity: Number(severity) }),
        ...(urgency !== undefined && { urgency: Number(urgency) }),
        ...(affectedSegments !== undefined && { affectedSegments }),
      },
    });

    return Response.json(apiSuccess(updated));
  } catch (err) {
    console.error("[pain-point PATCH]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update pain point"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; painPointId: string }> }
) {
  try {
    const { workspaceId, painPointId } = await getParams(params);
    await requireWorkspaceAccess(workspaceId);

    await prisma.painPoint.delete({ where: { id: painPointId, workspaceId } });
    return Response.json(apiSuccess({ deleted: true }));
  } catch (err) {
    console.error("[pain-point DELETE]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to delete pain point"), { status: 500 });
  }
}
