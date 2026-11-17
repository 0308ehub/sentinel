import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/autopilot/db";

const SITE_KEY = /^ks_[A-Za-z0-9_-]{24}$/;

function newSiteKey(): string {
  return `ks_${randomBytes(18).toString("base64url")}`;
}

export async function siteKeyFor(userId: string): Promise<string> {
  const sql = await db();
  const key = newSiteKey();
  const rows = await sql<{ site_key: string }[]>`
    insert into kismet.autopilot_sites (user_id, site_key)
    values (${userId}, ${key})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning site_key
  `;
  return rows[0].site_key;
}

export async function rotateSiteKey(userId: string): Promise<string> {
  const sql = await db();
  const key = newSiteKey();
  const rows = await sql<{ site_key: string }[]>`
    insert into kismet.autopilot_sites (user_id, site_key)
    values (${userId}, ${key})
    on conflict (user_id) do update set site_key = excluded.site_key, created_at = now()
    returning site_key
  `;
  return rows[0].site_key;
}

export async function userForSiteKey(key: string): Promise<string | null> {
  if (!SITE_KEY.test(key)) return null;
  const sql = await db();
  const rows = await sql<{ user_id: string }[]>`
    select user_id from kismet.autopilot_sites where site_key = ${key} limit 1
  `;
  return rows[0]?.user_id ?? null;
}
