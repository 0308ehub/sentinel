export function accountIdFor(auth: { userId?: string | null; orgId?: string | null }): string | null {
  return auth.orgId || auth.userId || null;
}
