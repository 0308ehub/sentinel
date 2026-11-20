import { auth, currentUser } from "@clerk/nextjs/server";
import { autopilotConfigured, db } from "@/lib/autopilot/db";
import { parseLocation } from "@/lib/workspace/live-sync-core";

export const dynamic = "force-dynamic";

async function organizationIdentity(): Promise<{ accountId: string; userId: string } | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  try {
    const identity = await auth();
    return identity.orgId && identity.userId ? { accountId: identity.orgId, userId: identity.userId } : null;
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  const identity = await organizationIdentity();
  if (!identity || !autopilotConfigured()) return Response.json([]);
  const sql = await db();
  const rows = await sql<{ userId: string; name: string; imageUrl: string; location: string }[]>`
    select user_id as "userId", name, image_url as "imageUrl", location
    from kismet.presence
    where account_id = ${identity.accountId}
      and user_id <> ${identity.userId}
      and seen_at > now() - interval '45 seconds'
    order by seen_at desc
  `;
  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const identity = await organizationIdentity();
  if (!identity || !autopilotConfigured()) return new Response(null, { status: 204 });
  const body = await request.json().catch(() => null) as { location?: unknown } | null;
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  if (!location || location.length > 200 || !parseLocation(location)) {
    return Response.json({ error: "invalid_location" }, { status: 400 });
  }
  const person = await currentUser();
  if (!person) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const name = person.fullName || person.firstName || person.primaryEmailAddress?.emailAddress || "Someone";
  const sql = await db();
  await sql`
    insert into kismet.presence (account_id, user_id, name, image_url, location, seen_at)
    values (${identity.accountId}, ${identity.userId}, ${name}, ${person.imageUrl ?? ""}, ${location}, now())
    on conflict (account_id, user_id) do update
      set name = excluded.name, image_url = excluded.image_url,
          location = excluded.location, seen_at = now()
  `;
  return new Response(null, { status: 204 });
}
