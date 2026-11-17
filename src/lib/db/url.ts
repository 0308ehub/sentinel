/** Connection string for the Postgres database. Supabase is Postgres, so either paste works. */
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

  const pass = encodeURIComponent(password);
  const region = env.SUPABASE_REGION?.trim() ?? "";
  if (/^[a-z0-9-]+$/i.test(region)) {
    return `postgresql://postgres.${ref}:${pass}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  }
  return `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`;
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
