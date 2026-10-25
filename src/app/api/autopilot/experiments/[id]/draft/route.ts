import { db } from "@/lib/autopilot/db";

export const dynamic = "force-dynamic";

/** The full file Autopilot wrote for an experiment, as plain text. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cleanup = new URL(request.url).searchParams.get("cleanup") === "1";
  const sql = await db();
  const [row] = await sql`select draft_path, draft, cleanup_draft from kismet.experiments where id = ${id}`;
  const content = cleanup ? row?.cleanup_draft : row?.draft;
  if (!content) return new Response("No stored change for this experiment.", { status: 404 });
  return new Response(`// ${row.draft_path}\n\n${content}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
