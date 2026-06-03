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
    if (!prd) {
      return Response.json(apiError("NOT_FOUND", "PRD not found"), { status: 404 });
    }

    const conversation = await prisma.conversation.upsert({
      where: { prdId_userId: { prdId, userId: user.id } },
      create: {
        workspaceId: prd.workspaceId,
        userId: user.id,
        prdId,
        title: `PRD: ${prd.title}`,
      },
      update: {},
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return Response.json(
      apiSuccess({
        conversationId: conversation.id,
        messages: (conversation.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
