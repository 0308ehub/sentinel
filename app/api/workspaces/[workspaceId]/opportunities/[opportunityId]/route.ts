import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

async function getParams(params: Promise<{ workspaceId: string; opportunityId: string }>) {
  return params;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; opportunityId: string }> }
) {
  try {
    const { workspaceId, opportunityId } = await getParams(params);
    await requireWorkspaceAccess(workspaceId);

    const body = await req.json();
    const { title, description, problemStatement, proposedSolution, status } = body;

    const updated = await prisma.opportunity.update({
      where: { id: opportunityId, workspaceId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(problemStatement !== undefined && { problemStatement }),
        ...(proposedSolution !== undefined && { proposedSolution }),
        ...(status !== undefined && { status }),
      },
    });

    return Response.json(apiSuccess(updated));
  } catch (err) {
    console.error("[opportunity PATCH]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update opportunity"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; opportunityId: string }> }
) {
  try {
    const { workspaceId, opportunityId } = await getParams(params);
    await requireWorkspaceAccess(workspaceId);

    await prisma.opportunity.delete({ where: { id: opportunityId, workspaceId } });
    return Response.json(apiSuccess({ deleted: true }));
  } catch (err) {
    console.error("[opportunity DELETE]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to delete opportunity"), { status: 500 });
  }
}
