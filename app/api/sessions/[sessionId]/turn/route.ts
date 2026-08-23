import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { processChildTurn } from "@/lib/learner/pipeline";
import { streamTutorResponse } from "@/lib/ai/tutor";
import { checkTutorOutput, SAFE_FALLBACK_RESPONSE } from "@/lib/ai/safety";

export const maxDuration = 300;

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { child: true },
  });
  if (!session || session.child.parentId !== user.id) {
    return Response.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return Response.json({ ok: false, error: { code: "INVALID_INPUT" } }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const turn = await processChildTurn(sessionId, text);

        // Surface the pedagogical decision so the UI can show the reasoning.
        controller.enqueue(
          sse({
            type: "action",
            action: turn.planner.next_action,
            target: turn.planner.target,
            strategy: turn.planner.strategy,
            observation: turn.planner.observation,
            reason: turn.planner.reason,
            blocked: turn.blocked ?? null,
          })
        );

        let full = "";
        for await (const chunk of streamTutorResponse({
          planner: turn.planner,
          context: turn.context,
        })) {
          full += chunk;
          controller.enqueue(sse({ type: "token", text: chunk }));
        }

        // Post-generation safety gate. If it fails, replace what the child sees.
        const verdict = await checkTutorOutput(full);
        const finalText = verdict.safe ? full : SAFE_FALLBACK_RESPONSE;
        if (!verdict.safe) {
          controller.enqueue(sse({ type: "replace", text: finalText }));
        }

        await prisma.message.create({
          data: {
            sessionId,
            role: "TUTOR",
            content: finalText,
            action: turn.planner.next_action,
            targetConcept: turn.planner.target ?? null,
            rationale: turn.planner.reason,
            safetyFlagged: !verdict.safe,
            safetyReason: verdict.reason ?? null,
          },
        });

        controller.enqueue(sse({ type: "done" }));
      } catch (err) {
        controller.enqueue(
          sse({ type: "error", message: err instanceof Error ? err.message : "Turn failed" })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
