import { AsyncLocalStorage } from "node:async_hooks";

const users = new AsyncLocalStorage<string>();

/** The account whose Autopilot rows the current call may read or write. */
export function autopilotUser(): string {
  const userId = users.getStore();
  if (!userId) throw new Error("Autopilot has no user.");
  return userId;
}

export function tryAutopilotUser(): string | null {
  return users.getStore() ?? null;
}

export function withAutopilotUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return users.run(userId, fn);
}

/** Visitors on this deployment belong to the named owner. Other accounts keep their own loop. */
export function siteAutopilotUser(): string | null {
  const named = process.env.KISMET_AUTOPILOT_USER_ID?.trim();
  if (named) return named;
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NODE_ENV !== "production") return "local";
  return null;
}

/** Cron runs every account that connected GitHub. With none connected, it keeps the single current account. */
export function tickUsers(connected: readonly string[], fallback: string | null): string[] {
  const ids = [...new Set(connected.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (ids.length > 0) return ids;
  return fallback ? [fallback] : [];
}
