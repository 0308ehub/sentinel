/** Public site origin. Marketing links, the sitemap, and Open Graph tags use this. */
export function siteUrl(): string {
  const configured = process.env.KISMET_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  // Production links (Slack replies, emails) must use the real domain: a per-deployment *.vercel.app URL
  // has no sign-in, so people land on a blank page.
  if (process.env.VERCEL_ENV === "production") return "https://app.sentinelai.one";
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "https://app.sentinelai.one";
}
