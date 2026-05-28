import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

async function verifyPRDAccess(prdId: string, userId: string) {
  return prisma.pRD.findFirst({
    where: {
      id: prdId,
      workspace: { organization: { memberships: { some: { userId } } } },
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ prdId: string }> }
) {
  try {
    const { prdId } = await params;
    const user = await requireUser();
    const prd = await verifyPRDAccess(prdId, user.id);
    if (!prd) return Response.json(apiError("NOT_FOUND", "PRD not found"), { status: 404 });

    const { count } = await prisma.engineeringTicket.deleteMany({ where: { prdId } });
    return Response.json(apiSuccess({ deleted: count }));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
