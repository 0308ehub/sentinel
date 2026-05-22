import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const user = await requireUser();

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        workspace: { include: { organization: { include: { memberships: { where: { userId: user.id } } } } } },
        _count: { select: { chunks: true } },
      },
    });

    if (!doc || doc.workspace.organization.memberships.length === 0) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 403 });
    }

    return Response.json(apiSuccess({ status: doc.status, chunkCount: doc._count.chunks }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to fetch document"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const user = await requireUser();

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        workspace: {
          include: {
            organization: {
              include: { memberships: { where: { userId: user.id } } },
            },
          },
        },
      },
    });

    if (!doc || doc.workspace.organization.memberships.length === 0) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 403 });
    }

    await prisma.document.delete({ where: { id: documentId } });

    return Response.json(apiSuccess({ documentId }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to delete document"), { status: 500 });
  }
}
