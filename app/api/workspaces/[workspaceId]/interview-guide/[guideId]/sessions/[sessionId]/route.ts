import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const PatchSessionSchema = z.object({
  intervieweeName: z.string().min(1).optional(),
  intervieweeRole: z.string().optional(),
  intervieweeCompany: z.string().optional(),
  date: z.string().optional(),
  generalNotes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string; sessionId: string }> }
) {
  try {
    const { workspaceId, guideId, sessionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, guideId },
      include: {
        notes: true,
        guide: {
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!session || session.guide.workspaceId !== workspaceId) {
      return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
    }

    return Response.json(apiSuccess(session));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string; sessionId: string }> }
) {
  try {
    const { workspaceId, guideId, sessionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = PatchSessionSchema.parse(await request.json());

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, guideId },
      include: { guide: { select: { workspaceId: true } } },
    });

    if (!session || session.guide.workspaceId !== workspaceId) {
      return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
    }

    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        ...(body.intervieweeName && { intervieweeName: body.intervieweeName }),
        ...(body.intervieweeRole !== undefined && { intervieweeRole: body.intervieweeRole }),
        ...(body.intervieweeCompany !== undefined && { intervieweeCompany: body.intervieweeCompany }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.generalNotes !== undefined && { generalNotes: body.generalNotes }),
      },
    });

    return Response.json(apiSuccess(updated));
  } catch (error) {
    console.error("[session PATCH]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
