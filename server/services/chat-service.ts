import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import { SENTINEL_CHAT_SYSTEM_PROMPT } from "@/prompts/chat-system";
import { retrieveWorkspaceContext, formatContextForPrompt } from "@/lib/retrieval/search";

export async function sendWorkspaceChatMessage(input: {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  message: string;
}) {
  const { workspaceId, userId, message } = input;

  // Get or create conversation
  let conversation = input.conversationId
    ? await prisma.conversation.findUnique({ where: { id: input.conversationId } })
    : null;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        userId,
        title: message.slice(0, 60),
      },
    });
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message,
    },
  });

  // Retrieve relevant context
  const context = await retrieveWorkspaceContext({ workspaceId, query: message });
  const contextText = formatContextForPrompt(context);

  // Fetch recent conversation history
  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages = history
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  // Prepend context to the last user message
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === "user" && contextText) {
      messages[messages.length - 1] = {
        role: "user",
        content: `${contextText}\n\n---\n\nUser question: ${last.content}`,
      };
    }
  }

  const responseText = await ai.generateText({
    system: SENTINEL_CHAT_SYSTEM_PROMPT,
    messages,
    temperature: 0.4,
    maxTokens: 4096,
  });

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: responseText,
    },
  });

  await prisma.productEvent.create({
    data: {
      workspaceId,
      userId,
      event: "chat_message_sent",
      properties: { conversationId: conversation.id },
    },
  });

  return { conversationId: conversation.id, assistantMessage };
}
