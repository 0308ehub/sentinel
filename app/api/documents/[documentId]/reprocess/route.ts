export const maxDuration = 300;

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { dispatchIngestion } from "@/server/jobs/dispatch";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const user = await requireUser();

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { workspace: { include: { organization: { include: { memberships: { where: { userId: user.id } } } } } } },
    });

    if (!doc || doc.workspace.organization.memberships.length === 0) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 403 });
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: "PENDING" } });
    await dispatchIngestion(documentId);

    return Response.json(apiSuccess({ documentId, status: "PENDING" }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to reprocess"), { status: 500 });
  }
}
