import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

async function verifyDigestAccess(digestId: string, workspaceId: string, userId: string) {
  return prisma.digest.findFirst({
    where: {
      id: digestId,
      workspaceId,
      workspace: { organization: { memberships: { some: { userId } } } },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; digestId: string }> }
) {
  try {
    const { workspaceId, digestId } = await params;
    const user = await requireUser();

    const digest = await verifyDigestAccess(digestId, workspaceId, user.id);
    if (!digest) {
      return Response.json(apiError("NOT_FOUND", "Digest not found"), { status: 404 });
    }

    const conversation = await prisma.conversation.upsert({
      where: { digestId_userId: { digestId, userId: user.id } },
      create: {
        workspaceId,
        userId: user.id,
        digestId,
        title: `Digest: ${new Date(digest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
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
