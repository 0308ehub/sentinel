import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { synthesizeWorkspace } from "@/server/services/synthesis-service";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const result = await synthesizeWorkspace(
          workspaceId,
          (step) => emit({ type: "step", step }),
          (pp) => emit({ type: "pain_point", data: pp })
        );
        emit({
          type: "done",
          painPoints: result.painPoints.length,
          opportunities: result.opportunities.length,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[synthesize]", err);
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
