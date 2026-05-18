import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { sendWorkspaceChatMessage } from "@/server/services/chat-service";
import { apiSuccess, apiError } from "@/types";

const ChatSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { user } = await requireWorkspaceAccess(workspaceId);

    const body = await request.json();
    const { message, conversationId } = ChatSchema.parse(body);

    const result = await sendWorkspaceChatMessage({
      workspaceId,
      userId: user.id,
      message,
      conversationId,
    });

    return Response.json(
      apiSuccess({
        conversationId: result.conversationId,
        message: {
          role: "assistant",
          content: result.assistantMessage.content,
        },
      })
    );
  } catch (error) {
    console.error("[chat]", error);
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    return Response.json(apiError("LLM_ERROR", "Chat failed"), { status: 500 });
  }
}
