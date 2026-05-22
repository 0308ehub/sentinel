import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generateEngineeringTickets } from "@/server/services/ticket-service";

const Schema = z.object({
  prdId: z.string().optional(),
  opportunityId: z.string().optional(),
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

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { prdId, opportunityId } = Schema.parse(body);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const result = await generateEngineeringTickets(
          { workspaceId, prdId, opportunityId },
          (ticket) => emit({ type: "ticket", data: ticket })
        );
        emit({ type: "done", count: result.tickets.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[tickets-generate]", err);
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
