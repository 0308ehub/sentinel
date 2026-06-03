import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  focusArea: z.string().optional(),
  openingStatement: z.string().min(1).optional(),
  closingStatement: z.string().min(1).optional(),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        theme: z.string().min(1),
        question: z.string().min(1),
        probe: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const guide = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
      include: {
        questions: { orderBy: { order: "asc" } },
        sessions: { orderBy: { date: "desc" } },
      },
    });

    if (!guide) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    return Response.json(apiSuccess(guide));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = PatchSchema.parse(await request.json());

    const existing = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
    });
    if (!existing) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.questions) {
        await tx.interviewQuestion.deleteMany({ where: { guideId } });
        await tx.interviewQuestion.createMany({
          data: body.questions.map((q, i) => ({
            guideId,
            theme: q.theme,
            question: q.question,
            probe: q.probe ?? null,
            order: i,
          })),
        });
      }

      return tx.interviewGuide.update({
        where: { id: guideId },
        data: {
          ...(body.title && { title: body.title }),
          ...(body.focusArea !== undefined && { focusArea: body.focusArea }),
          ...(body.openingStatement && { openingStatement: body.openingStatement }),
          ...(body.closingStatement && { closingStatement: body.closingStatement }),
        },
        include: { questions: { orderBy: { order: "asc" } }, sessions: { orderBy: { date: "desc" } } },
      });
    });

    return Response.json(apiSuccess(updated));
  } catch (error) {
    console.error("[interview-guide PATCH]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const existing = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
    });
    if (!existing) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    await prisma.interviewGuide.delete({ where: { id: guideId } });

    return Response.json(apiSuccess({ deleted: true }));
  } catch (error) {
    console.error("[interview-guide DELETE]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
