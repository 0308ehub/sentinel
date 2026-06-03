import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiError } from "@/types";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { retrieveWorkspaceContext } from "@/lib/retrieval/search";
import { buildPRDChatSystemPrompt } from "@/prompts/prd-chat-system";
import { MODELS } from "@/lib/ai/types";

const ChatSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string(),
  currentContent: z.string(),
});

async function verifyPRDAccess(prdId: string, userId: string) {
  return prisma.pRD.findFirst({
    where: {
      id: prdId,
      workspace: { organization: { memberships: { some: { userId } } } },
    },
    include: {
      opportunity: {
        select: {
          title: true,
          problemStatement: true,
          proposedSolution: true,
          targetSegments: true,
        },
      },
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ prdId: string }> }
) {
  const { prdId } = await params;

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const prd = await verifyPRDAccess(prdId, user.id);
  if (!prd) return new Response("Not found", { status: 404 });

  let body: z.infer<typeof ChatSchema>;
  try {
    body = ChatSchema.parse(await req.json());
  } catch {
    return Response.json(apiError("VALIDATION_ERROR", "Invalid input"), { status: 400 });
  }

  const { message, conversationId, currentContent } = body;

  // Save user message to DB
  await prisma.message.create({
    data: { conversationId, role: "USER", content: message },
  });

  // Load conversation history for context (all but the message we just saved)
  const history = await prisma.message.findMany({
    where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "asc" },
  });
  const priorMessages = history.slice(0, -1);

  // Fetch relevant evidence chunks (non-fatal if it fails)
  let evidenceChunks: string[] = [];
  try {
    const ctx = await retrieveWorkspaceContext({
      workspaceId: prd.workspaceId,
      query: message,
      limit: 6,
    });
    evidenceChunks = ctx.chunks.map((c) => c.content);
  } catch {
    // proceed without evidence
  }

  const systemPrompt = buildPRDChatSystemPrompt({
    currentContent,
    opportunity: prd.opportunity,
    evidenceChunks,
  });

  const anthropicMessages = [
    ...priorMessages.map((m) => ({
      role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Tag detection state
      let preEditBuffer = "";
      let prdEditBuffer = "";
      let inPRDEdit = false;
      let explanationText = "";

      try {
        const response = await getAnthropicClient().messages.create({
          model: MODELS.reasoning,
          max_tokens: 8192,
          system: systemPrompt,
          messages: anthropicMessages,
          stream: true,
        });

        for await (const event of response) {
          if (event.type !== "content_block_delta") continue;
          if (event.delta.type !== "text_delta") continue;

          const chunk = event.delta.text;

          if (!inPRDEdit) {
            preEditBuffer += chunk;
            const tagIdx = preEditBuffer.indexOf("<prd_edit>");

            if (tagIdx >= 0) {
              // Emit and record everything before the opening tag
              const before = preEditBuffer.slice(0, tagIdx);
              if (before) {
                emit({ type: "text_delta", content: before });
                explanationText += before;
              }
              inPRDEdit = true;
              // Text after the opening tag starts the PRD buffer
              prdEditBuffer = preEditBuffer.slice(tagIdx + 10);
              preEditBuffer = "";
            } else {
              // Emit safely, keeping last 9 chars in buffer in case the tag
              // spans a chunk boundary (e.g. "<prd_edi" | "t>")
              if (preEditBuffer.length > 9) {
                const safe = preEditBuffer.slice(0, -9);
                emit({ type: "text_delta", content: safe });
                explanationText += safe;
                preEditBuffer = preEditBuffer.slice(-9);
              }
            }
          } else {
            prdEditBuffer += chunk;
            const closeIdx = prdEditBuffer.indexOf("</prd_edit>");

            if (closeIdx >= 0) {
              const proposedContent = prdEditBuffer.slice(0, closeIdx).trim();
              emit({ type: "prd_edit", proposedContent });
              const afterClose = prdEditBuffer.slice(closeIdx + 11);
              inPRDEdit = false;
              prdEditBuffer = "";
              if (afterClose) {
                emit({ type: "text_delta", content: afterClose });
                explanationText += afterClose;
              }
            }
          }
        }

        // Flush any remaining pre-tag buffer
        if (!inPRDEdit && preEditBuffer) {
          emit({ type: "text_delta", content: preEditBuffer });
          explanationText += preEditBuffer;
        }

        if (inPRDEdit) {
          console.error("[prd-chat] Malformed: <prd_edit> opened but never closed");
          emit({ type: "error", message: "AI returned a malformed response. Please try again." });
        } else {
          emit({ type: "done" });
        }

        // Save assistant explanation text (not the prd_edit content)
        if (explanationText.trim()) {
          await prisma.message
            .create({
              data: {
                conversationId,
                role: "ASSISTANT",
                content: explanationText.trim(),
              },
            })
            .catch((err) =>
              console.error("[prd-chat] Failed to save assistant message:", err)
            );
        }
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Chat failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
