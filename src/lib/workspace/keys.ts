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
