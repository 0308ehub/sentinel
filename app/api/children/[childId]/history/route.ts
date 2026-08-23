import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const scopeSchema = z.object({
  /**
   * conversation — clear just the session named by sessionId, keeping every other
   *                conversation and everything the mentor has learned.
   * everything    — full reset: all transcripts, learner graph, mastery, mentor name.
   */
  scope: z.enum(["conversation", "everything"]).default("conversation"),
  sessionId: z.string().optional(),
});

export async function DELETE(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;

  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Sign in required"), { status: 401 });
  }

  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child || child.parentId !== user.id) {
    return Response.json(apiError("NOT_FOUND", "Child not found"), { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = scopeSchema.safeParse(body);
  if (!parsed.success) return Response.json(apiError("INVALID_INPUT", "bad scope"), { status: 400 });
  const { scope, sessionId } = parsed.data;

  // Sessions cascade to their messages; observations and interventions reference
  // sessions with SetNull, so they are cleared explicitly when wiping everything.
  await prisma.$transaction(async (tx) => {
    if (scope === "everything") {
      await tx.memoryEdge.deleteMany({
        where: { source: { childId } },
      });
      await tx.memoryNode.deleteMany({ where: { childId } });
      await tx.hypothesis.deleteMany({ where: { childId } });
      await tx.intervention.deleteMany({ where: { childId } });
      await tx.observation.deleteMany({ where: { childId } });
      await tx.learnerSkillState.deleteMany({ where: { childId } });
      await tx.learningEvent.deleteMany({ where: { childId } });
      await tx.mentorProfile.updateMany({
        where: { childId },
        data: {
          mentorName: null,
          mentorNamedAt: null,
          semanticSummary: null,
          longitudinalNarrative: null,
        },
      });
      await tx.session.deleteMany({ where: { childId } });
    } else if (sessionId) {
      // Only the conversation the parent is looking at. Everything the mentor
      // learned survives, and so does every other conversation.
      await tx.observation.updateMany({ where: { childId, sessionId }, data: { sessionId: null } });
      await tx.intervention.updateMany({ where: { childId, sessionId }, data: { sessionId: null } });
      await tx.session.deleteMany({ where: { id: sessionId, childId } });
      // Close any other session still marked active, or the next load resumes a
      // stale one and the screen refills with talk the parent just cleared.
      await tx.session.updateMany({
        where: { childId, status: "ACTIVE" },
        data: { status: "COMPLETED", endedAt: new Date() },
      });
    }
  });

  return Response.json(apiSuccess({ scope, cleared: true }));
}
