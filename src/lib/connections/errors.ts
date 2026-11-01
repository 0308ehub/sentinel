/** Connector errors carry a user-facing `hint`; prefer it over the raw error code. */
export function connectErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if ("hint" in error && typeof error.hint === "string" && error.hint) return error.hint;
  return error.message || fallback;
}
