import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiError } from "@/types";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/types";

const ChatSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string(),
  currentContent: z.string(),
});

async function verifyDigestAccess(digestId: string, workspaceId: string, userId: string) {
  return prisma.digest.findFirst({
    where: {
      id: digestId,
      workspaceId,
      workspace: { organization: { memberships: { some: { userId } } } },
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; digestId: string }> }
) {
  const { workspaceId, digestId } = await params;

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const digest = await verifyDigestAccess(digestId, workspaceId, user.id);
  if (!digest) return new Response("Not found", { status: 404 });

  let body: z.infer<typeof ChatSchema>;
  try {
    body = ChatSchema.parse(await req.json());
  } catch {
    return Response.json(apiError("VALIDATION_ERROR", "Invalid input"), { status: 400 });
  }

  const { message, conversationId, currentContent } = body;

  await prisma.message.create({
    data: { conversationId, role: "USER", content: message },
  });

  const history = await prisma.message.findMany({
    where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "asc" },
  });
  const priorMessages = history.slice(0, -1);

  const systemPrompt = `You are an AI assistant helping a PM edit and refine their daily digest.

The current digest content is:
<current_digest>
${currentContent}
</current_digest>

You can answer questions about the digest, discuss its contents, or propose a full rewrite.
When you want to propose a new version of the entire digest, wrap it in <digest_edit> tags:
<digest_edit>
...complete new digest content here...
</digest_edit>

Only use <digest_edit> when proposing a full content replacement. For discussion or clarification, respond normally.
Keep digest content concise, structured with ## headers, and data-driven.`;

  const anthropicMessages = [
    ...priorMessages.map((m) => ({
      role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let preEditBuffer = "";
      let digestEditBuffer = "";
      let inDigestEdit = false;
      let explanationText = "";

      try {
        const response = await getAnthropicClient().messages.create(
          {
            model: MODELS.reasoning,
            max_tokens: 4096,
            system: systemPrompt,
            messages: anthropicMessages,
            stream: true,
          },
          { signal: abortController.signal }
        );

        for await (const event of response) {
          if (event.type !== "content_block_delta") continue;
          if (event.delta.type !== "text_delta") continue;

          const chunk = event.delta.text;

          if (!inDigestEdit) {
            preEditBuffer += chunk;
            const tagIdx = preEditBuffer.indexOf("<digest_edit>");

            if (tagIdx >= 0) {
              const before = preEditBuffer.slice(0, tagIdx);
              if (before) {
                emit({ type: "text_delta", content: before });
                explanationText += before;
              }
              inDigestEdit = true;
              digestEditBuffer = preEditBuffer.slice(tagIdx + 13);
              preEditBuffer = "";
            } else {
              if (preEditBuffer.length > 12) {
                const safe = preEditBuffer.slice(0, -12);
                emit({ type: "text_delta", content: safe });
                explanationText += safe;
                preEditBuffer = preEditBuffer.slice(-12);
              }
            }
          } else {
            digestEditBuffer += chunk;
            const closeIdx = digestEditBuffer.indexOf("</digest_edit>");

            if (closeIdx >= 0) {
              const proposedContent = digestEditBuffer.slice(0, closeIdx).trim();
              emit({ type: "digest_edit", proposedContent });
              const afterClose = digestEditBuffer.slice(closeIdx + 14);
              inDigestEdit = false;
              digestEditBuffer = "";
              if (afterClose) {
                emit({ type: "text_delta", content: afterClose });
                explanationText += afterClose;
              }
            }
          }
        }

        if (!inDigestEdit && preEditBuffer) {
          emit({ type: "text_delta", content: preEditBuffer });
          explanationText += preEditBuffer;
        }

        if (inDigestEdit) {
          emit({ type: "error", message: "AI returned a malformed response. Please try again." });
        } else {
          emit({ type: "done" });
        }

        if (explanationText.trim()) {
          await prisma.message
            .create({
              data: {
                conversationId,
                role: "ASSISTANT",
                content: explanationText.trim(),
              },
            })
            .catch(() => undefined);
        }
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Chat failed" });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
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
