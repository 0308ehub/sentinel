import { db } from "@/lib/autopilot/db";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

/** The full file Autopilot wrote for an experiment, as plain text. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return new Response("Sign in required.", { status: 401 });
  const { id } = await params;
  const cleanup = new URL(request.url).searchParams.get("cleanup") === "1";
  const sql = await db();
  const [row] = await sql`
    select draft_path, draft, cleanup_draft from kismet.experiments where user_id = ${userId} and id = ${id}
  `;
  const content = cleanup ? row?.cleanup_draft : row?.draft;
  if (!content) return new Response("No stored change for this experiment.", { status: 404 });
  return new Response(`// ${row.draft_path}\n\n${content}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
