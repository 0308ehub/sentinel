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

    let conversation = await prisma.conversation.findFirst({
      where: { prdId, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          workspaceId: prd.workspaceId,
          userId: user.id,
          prdId,
          title: `PRD: ${prd.title}`,
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

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
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}
