import { AsyncLocalStorage } from "node:async_hooks";

const users = new AsyncLocalStorage<string>();

/** The account whose Autopilot rows the current call may read or write. */
export function autopilotUser(): string {
  const userId = users.getStore();
  if (!userId) throw new Error("Kismet has no user.");
  return userId;
}

export function tryAutopilotUser(): string | null {
  return users.getStore() ?? null;
}

export function withAutopilotUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return users.run(userId, fn);
}

/** Visitors on this deployment belong to the named owner. Other accounts keep their own loop. */
export async function resolveMovedAccount(accountId: string | null): Promise<string | null> {
  if (!accountId) return null;
  try {
    const { db } = await import("@/lib/autopilot/db");
    const sql = await db();
    const rows = await sql<{ to_id: string }[]>`select to_id from kismet.account_moves where from_id = ${accountId} limit 1`;
    return rows[0]?.to_id ?? accountId;
  } catch {
    return accountId;
  }
}

export async function siteAutopilotUser(): Promise<string | null> {
  const named = process.env.KISMET_AUTOPILOT_USER_ID?.trim();
  if (named) return resolveMovedAccount(named);
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NODE_ENV !== "production") return "local";
  return null;
}

/** Cron runs every account that connected GitHub. With none connected, it keeps the single current account. */
export function tickUsers(connected: readonly string[], fallback: string | null): string[] {
  const ids = [...new Set(connected.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (ids.length > 0) return ids;
  return fallback ? [fallback] : [];
}
