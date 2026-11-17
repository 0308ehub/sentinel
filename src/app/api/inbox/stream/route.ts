import { inboxUser } from "@/lib/inbox/http";
import { listInbox } from "@/lib/inbox/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await inboxUser();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const inbox = await listInbox(userId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ threads: inbox.threads, attention: inbox.attention })}\n\n`));
        } catch {
          // The next tick tries again.
        }
      };
      void send();
      timer = setInterval(() => void send(), 2000);
    },
    cancel() {
      if (timer) clearInterval(timer);
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
