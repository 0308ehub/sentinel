import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { runPlanner, stageForTurn } from "@/lib/ai/planner";
import { buildLearnerContext } from "@/lib/learner/memory";
import { updateHypotheses } from "@/lib/learner/hypothesis-engine";
import { updateSkillState } from "@/lib/learner/mastery";
import { checkChildInput } from "@/lib/ai/safety";
import { persistMemories } from "@/lib/learner/pipeline";
import { buildRealtimeInstructions } from "@/lib/ai/realtime";
import { apiSuccess, apiError } from "@/types";

export const maxDuration = 300;

/**
 * The pedagogical brain, running BEHIND the live conversation. The realtime model
 * has already replied by the time this finishes; what we return steers the next
 * turn, not this one (spec §12).
 */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Sign in required"), { status: 401 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { child: true },
  });
  if (!session || session.child.parentId !== user.id) {
    return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
  }

  const { childText, tutorText } = (await req.json()) as {
    childText?: string;
    tutorText?: string;
  };
  if (!childText?.trim()) {
    return Response.json(apiError("INVALID_INPUT", "childText required"), { status: 400 });
  }

  const verdict = await checkChildInput(childText);

  await prisma.message.create({
    data: {
      sessionId,
      role: "CHILD",
      content: childText,
      safetyFlagged: !verdict.safe,
      safetyReason: verdict.reason ?? null,
    },
  });
  if (tutorText?.trim()) {
    await prisma.message.create({
      data: { sessionId, role: "TUTOR", content: tutorText },
    });
  }

  const [context, childTurns, priorSessions] = await Promise.all([
    buildLearnerContext(session.childId, sessionId),
    prisma.message.count({ where: { sessionId, role: "CHILD" } }),
    prisma.session.count({ where: { childId: session.childId } }),
  ]);
  const stage = stageForTurn(childTurns - 1, priorSessions <= 1);

  if (!verdict.safe) {
    return Response.json(
      apiSuccess({
        blocked: true,
        guidance:
          "The child said something outside what we handle. Gently and calmly move the conversation back to something friendly. Do not engage with what they said.",
        instructions: buildRealtimeInstructions(context, stage),
      })
    );
  }

  const planner = await runPlanner({ context, childResponse: childText, stage });

  const observation = await prisma.observation.create({
    data: {
      childId: session.childId,
      sessionId,
      conceptId: planner.target ?? null,
      prompt: tutorText ?? "(spoken)",
      response: childText,
      correctness: planner.correctness ?? null,
      reasoningEvidence: planner.reasoning_evidence,
      reasoningPattern: planner.reasoning_pattern ?? null,
    },
  });

  await updateHypotheses(session.childId, observation.id, planner.updated_hypotheses);

  if (
    planner.next_action !== "CONNECT" &&
    planner.target &&
    planner.correctness !== null &&
    planner.correctness !== undefined
  ) {
    await updateSkillState(session.childId, planner.target, {
      correct: planner.correctness,
      independent: planner.next_action !== "EXPLAIN" && planner.next_action !== "GIVE_EXAMPLE",
      reasonedCorrectly: planner.reasoning_evidence.length > 0,
    });
  }

  await prisma.intervention.create({
    data: {
      childId: session.childId,
      sessionId,
      conceptId: planner.target ?? null,
      action: planner.next_action,
      strategy: planner.strategy ?? planner.next_action.toLowerCase(),
      rationale: planner.reason,
    },
  });

  if (planner.mentor_name && !context.mentorName) {
    const clean = planner.mentor_name.trim().slice(0, 30);
    if (clean) {
      await prisma.mentorProfile.update({
        where: { childId: session.childId },
        data: { mentorName: clean, mentorNamedAt: new Date() },
      });
      context.mentorName = clean;
    }
  }

  try {
    await persistMemories(session.childId, planner);
  } catch (err) {
    console.error("[observe] memory persistence failed:", err);
  }

  const guidance = [
    `Next move: ${planner.next_action}${planner.target ? ` on ${planner.target}` : ""}.`,
    planner.strategy ? `Use: ${planner.strategy.replace(/_/g, " ")}.` : "",
    planner.response_goal,
  ]
    .filter(Boolean)
    .join(" ");

  return Response.json(
    apiSuccess({
      action: planner.next_action,
      target: planner.target,
      observation: planner.observation,
      reason: planner.reason,
      mentorName: context.mentorName,
      guidance,
      instructions: buildRealtimeInstructions(context, stage, guidance),
    })
  );
}
