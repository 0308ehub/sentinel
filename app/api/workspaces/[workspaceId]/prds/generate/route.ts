import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generatePRD } from "@/server/services/prd-service";

const Schema = z.object({
  opportunityId: z.string().optional(),
  userInstruction: z.string().optional(),
});

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  let user: Awaited<ReturnType<typeof requireWorkspaceAccess>>["user"];
  try {
    ({ user } = await requireWorkspaceAccess(workspaceId));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { opportunityId, userInstruction } = Schema.parse(body);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const prd = await generatePRD({
          workspaceId,
          opportunityId,
          userInstruction,
          userId: user.id,
          onStep: (step) => emit({ type: "step", step }),
        });
        emit({ type: "done", id: prd.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate PRD";
        console.error("[prd-generate]", err);
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
