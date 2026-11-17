import { addEvidence } from "@/lib/autopilot/store";
import { db, newId } from "@/lib/autopilot/db";
import { siteAutopilotUser, withAutopilotUser } from "@/lib/autopilot/scope";
import { currentUserId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

const DAILY_LIMIT = 20;

function error(message: string, status: number): Response {
  return new Response(message, { status });
}

function firstLine(message: string): string {
  return (message.split(/\r?\n/, 1)[0] || message).slice(0, 120);
}

export async function POST(request: Request): Promise<Response> {
  const reporterId = await currentUserId();
  if (!reporterId) return error("Sign in required.", 401);
  const owner = siteAutopilotUser();
  if (!owner) return error("Feedback is not set up.", 503);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return error("Message must be between 10 and 2000 characters.", 400);
  }
  const body = input as { message?: unknown; page?: unknown };
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const page = typeof body?.page === "string" ? body.page.trim() : null;
  if (message.length < 10 || message.length > 2000) {
    return error("Message must be between 10 and 2000 characters.", 400);
  }
  if ((body?.page !== undefined && typeof body.page !== "string") || (page?.length ?? 0) > 200) {
    return error("Page must be 200 characters or fewer.", 400);
  }

  try {
    const sql = await db();
    const rows = await sql`
      select count(*)::int as count from kismet.feedback
      where user_id = ${reporterId} and created_at >= date_trunc('day', now())
    `;
    if (Number(rows[0]?.count ?? 0) >= DAILY_LIMIT) return error("Daily feedback limit reached.", 429);
    const id = newId("fb");
    const occurredAt = new Date().toISOString();
    await sql`
      insert into kismet.feedback (id, user_id, message, page, created_at)
      values (${id}, ${reporterId}, ${message}, ${page || null}, ${occurredAt})
    `;
    await withAutopilotUser(owner, () => addEvidence([{
      source: "interview",
      synthetic: false,
      title: firstLine(message),
      body: page ? `${message}\n\nReported on ${page}.` : message,
      author: "Kismet user",
      url: `kismet://feedback/${id}`,
      occurredAt,
    }]));
    return Response.json({ ok: true });
  } catch (caught) {
    console.error("[feedback]", caught);
    return error("Could not send feedback.", 500);
  }
}
