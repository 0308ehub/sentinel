import { db } from "@/lib/autopilot/db";

export const dynamic = "force-dynamic";

/** The full file Autopilot wrote for an experiment, as plain text. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = await db();
  const [row] = await sql`select draft_path, draft from kismet.experiments where id = ${id}`;
  if (!row?.draft) return new Response("No stored change for this experiment.", { status: 404 });
  return new Response(`// ${row.draft_path}\n\n${row.draft}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
