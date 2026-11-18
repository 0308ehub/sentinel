/** A new account. Sign-up is the only path that starts onboarding. */
export const SIGN_UP_DESTINATION = "/onboarding/you";

/** An account that already exists. Sign-in opens the workspace. */
export const SIGN_IN_DESTINATION = "/ai";

/** A signup still in progress. Older accounts are sent to the workspace. */
const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

export function isExistingAccount(createdAt: Date | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  return now - createdAt.getTime() > NEW_ACCOUNT_WINDOW_MS;
}
