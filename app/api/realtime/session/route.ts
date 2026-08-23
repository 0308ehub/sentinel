import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { buildLearnerContext } from "@/lib/learner/memory";
import { stageForTurn } from "@/lib/ai/planner";
import {
  buildRealtimeInstructions,
  buildTranscriptionPrompt,
  REALTIME_MODEL,
  REALTIME_VOICE,
} from "@/lib/ai/realtime";
import { apiSuccess, apiError } from "@/types";

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Sign in required"), { status: 401 });
  }

  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId) return Response.json(apiError("INVALID_INPUT", "sessionId required"), { status: 400 });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { child: true },
  });
  if (!session || session.child.parentId !== user.id) {
    return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
  }

  const [context, childTurns, priorSessions, lastSession, totalMessages] = await Promise.all([
    buildLearnerContext(session.childId, sessionId),
    prisma.message.count({ where: { sessionId, role: "CHILD" } }),
    prisma.session.count({ where: { childId: session.childId } }),
    prisma.session.findFirst({
      where: { childId: session.childId, id: { not: sessionId }, summary: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { summary: true },
    }),
    prisma.message.count({ where: { session: { childId: session.childId } } }),
  ]);
  const stage = stageForTurn(childTurns, priorSessions <= 1);
  const isFirstEver = totalMessages === 0;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const secret = await client.realtime.clientSecrets.create({
    expires_after: { anchor: "created_at", seconds: 600 },
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      instructions: buildRealtimeInstructions(context, stage, undefined, {
        isFirstEver,
        lastSessionSummary: lastSession?.summary ?? null,
        childTurnCount: childTurns,
      }),
      audio: {
        input: {
          // whisper-1 invents text on silence — it produced phantom child turns
          // like "BOOM!". gpt-4o-transcribe is far more reluctant to hallucinate.
          transcription: {
            model: "gpt-4o-transcribe",
            language: "en",
            prompt: buildTranscriptionPrompt(context),
          },
          // Semantic VAD waits for a natural end of thought, which matters a lot
          // with children — they pause mid-sentence far more than adults.
          // Low eagerness makes it wait longer still before deciding they're done.
          turn_detection: { type: "semantic_vad", eagerness: "low" },
          noise_reduction: { type: "near_field" },
        },
        output: { voice: REALTIME_VOICE, speed: 1.0 },
      },
    },
  });

  return Response.json(
    apiSuccess({
      clientSecret: secret.value,
      model: REALTIME_MODEL,
      mentorName: context.mentorName,
      childName: context.childName,
      stage,
      isFirstEver,
    })
  );
}
