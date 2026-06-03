import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const CreateSessionSchema = z.object({
  intervieweeName: z.string().min(1),
  intervieweeRole: z.string().optional(),
  intervieweeCompany: z.string().optional(),
  date: z.string(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const guide = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
    });
    if (!guide) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    const body = CreateSessionSchema.parse(await request.json());

    const session = await prisma.interviewSession.create({
      data: {
        guideId,
        intervieweeName: body.intervieweeName,
        intervieweeRole: body.intervieweeRole ?? null,
        intervieweeCompany: body.intervieweeCompany ?? null,
        date: new Date(body.date),
      },
    });

    return Response.json(apiSuccess(session), { status: 201 });
  } catch (error) {
    console.error("[sessions POST]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to create session"), { status: 500 });
  }
}
