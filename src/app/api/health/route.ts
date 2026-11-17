import { autopilotConfigured, db } from "@/lib/autopilot/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!autopilotConfigured()) {
    return Response.json({ ok: false, database: "not_configured" }, { status: 503 });
  }
  try {
    const sql = await db();
    await sql`select 1`;
    return Response.json({ ok: true, database: "ok" });
  } catch (error) {
    console.error("[health]", error);
    return Response.json({ ok: false, database: "error" }, { status: 503 });
  }
}
