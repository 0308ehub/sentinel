/** Kismet's own Postgres. A pasted URI wins. Otherwise a Supabase project URL plus its database password becomes the direct connection. */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const pasted = [env.KISMET_DATABASE_URL, env.DATABASE_URL, env.SUPABASE_DB_URL];
  for (const value of pasted) {
    const url = value?.trim();
    if (url && /^postgres(ql)?:\/\//i.test(url)) return url;
  }

  const projectUrl = [env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL, env.DATABASE_URL]
    .map((value) => value?.trim())
    .find((value) => value && /^https:\/\//i.test(value));
  const ref = projectRef(projectUrl);
  const password = env.SUPABASE_DB_PASSWORD?.trim();
  if (!ref || !password) return null;

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

/** Transaction poolers reject prepared statements, so the client has to turn them off. */
export function pooledDatabase(url: string): boolean {
  return /pooler\.supabase\.(co|com)|:6543(?:\/|\?|$)/.test(url);
}

export function projectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host.endsWith(".supabase.co") && !host.endsWith(".supabase.com")) return null;
    const ref = host.split(".")[0];
    if (!ref || ref === "db" || ref === "aws-0" || ref === "pooler") return null;
    return ref;
  } catch {
    return null;
  }
}
