import { autopilotConfigured, db } from "@/lib/autopilot/db";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const accountId = await currentAccountId();
  if (!accountId) return Response.json({ error: "sign_in_required" }, { status: 401 });
  if (!autopilotConfigured()) return Response.json({ version: 0 }, { headers: { "Cache-Control": "no-store" } });
  const sql = await db();
  const [row] = await sql<{ version: string }[]>`
    select version::text as version from kismet.account_versions where account_id = ${accountId}
  `;
  return Response.json({ version: Number(row?.version ?? 0) }, { headers: { "Cache-Control": "no-store" } });
}
