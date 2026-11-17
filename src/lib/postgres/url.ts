/** A customer's database URL. Kismet's own Supabase URL is a separate deploy setting. */
export function postgresUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) return null;
    const database = parsed.pathname.replace(/^\//, "");
    if (!database) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function databaseLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return database || parsed.hostname;
  } catch {
    return "Postgres";
  }
}
