import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { workspace } = await requireWorkspaceAccess(workspaceId);
    const full = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: { select: { documents: true, painPoints: true, opportunities: true, conversations: true } },
        organization: true,
      },
    });
    return Response.json(apiSuccess(full));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    const body = await request.json();
    const data = PatchSchema.parse(body);
    const workspace = await prisma.workspace.update({ where: { id: workspaceId }, data });
    return Response.json(apiSuccess(workspace));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update workspace"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    await prisma.workspace.delete({ where: { id: workspaceId } });
    return Response.json(apiSuccess({ deleted: true }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to delete workspace"), { status: 500 });
  }
}
