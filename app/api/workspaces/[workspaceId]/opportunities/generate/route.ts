import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generateOpportunities } from "@/server/services/opportunity-service";

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
        const opportunities = await generateOpportunities(workspaceId, undefined, (step) =>
          emit({ type: "step", step })
        );
        emit({ type: "done", count: opportunities.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[generate-opportunities]", err);
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
