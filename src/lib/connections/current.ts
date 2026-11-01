import "server-only";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

async function isCronRequest(): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  try {
    return (await headers()).get("authorization") === `Bearer ${secret}`;
  } catch {
    return false;
  }
}

export async function currentUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return "local";
  try {
    const userId = (await auth()).userId;
    if (userId) return userId;
  } catch {
    // Fall through to the cron identity check.
  }
  // The Vercel cron has no signed-in user; it acts for the one owner named in KISMET_AUTOPILOT_USER_ID.
  if (await isCronRequest()) return process.env.KISMET_AUTOPILOT_USER_ID?.trim() || null;
  return null;
}
