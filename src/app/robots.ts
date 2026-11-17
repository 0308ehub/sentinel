import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/ai",
          "/agents",
          "/autopilot",
          "/dashboard",
          "/explorer",
          "/features",
          "/design",
          "/board",
          "/timeline",
          "/graph",
          "/analytics",
          "/experiments",
          "/decisions",
          "/settings",
          "/onboarding",
          "/p/",
          "/sign-in",
          "/sign-up",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
