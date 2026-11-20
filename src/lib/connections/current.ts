import "server-only";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { siteAutopilotUser, tryAutopilotUser } from "@/lib/autopilot/scope";
import { accountIdFor } from "@/lib/connections/current-core";

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
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return process.env.NODE_ENV === "production" ? null : "local";
  }
  try {
    const userId = (await auth()).userId;
    if (userId) return userId;
  } catch {
    // Fall through to the cron identity check.
  }
  // The Vercel cron has no signed-in user; it acts for the one owner named in KISMET_AUTOPILOT_USER_ID.
  if (await isCronRequest()) return siteAutopilotUser();
  return null;
}

/** The active shared organization, or the signed-in person for personal use. */
export async function currentAccountId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return process.env.NODE_ENV === "production" ? null : "local";
  }
  try {
    const identity = await auth();
    const accountId = accountIdFor(identity);
    if (accountId) return accountId;
  } catch {
    // Fall through to the cron identity check.
  }
  if (await isCronRequest()) return siteAutopilotUser();
  return null;
}

/** The signed-in account, unless a cron tick is acting for one specific account. */
export async function actingUserId(): Promise<string | null> {
  return tryAutopilotUser() ?? (await currentAccountId());
}
