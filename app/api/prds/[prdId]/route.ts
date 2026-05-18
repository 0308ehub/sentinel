import { z } from "zod";
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ prdId: string }> }
) {
  try {
    const { prdId } = await params;
    const user = await requireUser();
    const prd = await verifyPRDAccess(prdId, user.id);
    if (!prd) return Response.json(apiError("NOT_FOUND", "PRD not found"), { status: 404 });

    const full = await prisma.pRD.findUnique({
      where: { id: prdId },
      include: { opportunity: true, tickets: true },
    });
    return Response.json(apiSuccess(full));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}

const PatchSchema = z.object({ content: z.string().min(1) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ prdId: string }> }
) {
  try {
    const { prdId } = await params;
    const user = await requireUser();
    const prd = await verifyPRDAccess(prdId, user.id);
    if (!prd) return Response.json(apiError("NOT_FOUND", "PRD not found"), { status: 404 });

    const { content } = PatchSchema.parse(await request.json());
    const updated = await prisma.pRD.update({ where: { id: prdId }, data: { content } });
    return Response.json(apiSuccess(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update PRD"), { status: 500 });
  }
}
