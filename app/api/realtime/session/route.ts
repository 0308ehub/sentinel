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
      // Bounds a runaway monologue without clipping a normal turn. NOTE: in the
      // Realtime API this counts AUDIO tokens, which accrue at roughly 50 per
      // second of speech — 320 was about six seconds and was cutting explanations
      // off mid-sentence. This is roughly half a minute, comfortably more than any
      // single turn should need, while still stopping the model running through
      // several exchanges in one breath.
      max_output_tokens: 1500,
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
          // Semantic VAD judges whether the thought is finished rather than just
          // timing silence, which matters with children — they pause mid-sentence
          // far more than adults. Eagerness caps how long it may wait when unsure:
          // low 8s, medium 4s, high 2s. Low read as the app being stuck.
          turn_detection: {
            type: "semantic_vad",
            eagerness: "medium",
            // Deliberately NOT interrupting mid-reply. On laptop speakers the
            // mentor's own voice returns through the mic and trips the detector,
            // which cut sentences in half. Turns are capped short, so finishing
            // the sentence costs at most a second or two and the child is heard
            // immediately afterwards.
            interrupt_response: false,
            create_response: true,
          },
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
