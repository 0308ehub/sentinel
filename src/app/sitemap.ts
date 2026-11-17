import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/lib/comparisons";
import { PRODUCT_DOCS } from "@/lib/product-docs";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const now = new Date();
  const paths = [
    "/",
    "/connectors",
    "/learn",
    "/docs",
    "/contact",
    "/benchmark",
    "/blog",
    "/compare",
    "/enterprise",
    "/pricing",
    "/privacy",
    "/terms",
    ...PRODUCT_DOCS.map((doc) => `/docs/${doc.slug}`),
    ...COMPARISONS.map((item) => `/compare/${item.slug}`),
  ];
  return paths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
