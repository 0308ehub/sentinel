/** Public site origin. Marketing links, the sitemap, and Open Graph tags use this. */
export function siteUrl(): string {
  const configured = process.env.KISMET_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "https://app.sentinelai.one";
}
