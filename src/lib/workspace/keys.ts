export const STATE_KEYS = [
  "graph",
  "chats",
  "context",
  "onboarding",
  "settings",
  "agents",
  "design",
  "notifications",
  "analytics",
  "notebooks",
] as const;

export type StateKey = (typeof STATE_KEYS)[number];

export function isStateKey(value: unknown): value is StateKey {
  return typeof value === "string" && (STATE_KEYS as readonly string[]).includes(value);
}

/** Kept per person even inside a shared workspace: chat history and each person's own setup and alerts. */
export const PERSONAL_STATE_KEYS: readonly StateKey[] = ["chats", "onboarding", "notifications"];

export function isPersonalStateKey(key: StateKey): boolean {
  return PERSONAL_STATE_KEYS.includes(key);
}
