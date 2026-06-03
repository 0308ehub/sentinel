import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const NotesSchema = z.object({
  notes: z.array(
    z.object({
      questionId: z.string().min(1),
      content: z.string(),
    })
  ),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string; sessionId: string }> }
) {
  try {
    const { workspaceId, guideId, sessionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, guideId },
      include: { guide: { select: { workspaceId: true } } },
    });

    if (!session || session.guide.workspaceId !== workspaceId) {
      return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
    }

    const body = NotesSchema.parse(await request.json());

    await prisma.$transaction(
      body.notes.map(({ questionId, content }) =>
        prisma.sessionNote.upsert({
          where: { sessionId_questionId: { sessionId, questionId } },
          create: { sessionId, questionId, content },
          update: { content },
        })
      )
    );

    return Response.json(apiSuccess({ saved: body.notes.length }));
  } catch (error) {
    console.error("[notes PUT]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to save notes"), { status: 500 });
  }
}
