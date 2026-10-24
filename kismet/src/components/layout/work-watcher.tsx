"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { compactText, seePage } from "@/lib/work-context";

const PAGE_LABELS: [string, string][] = [
  ["/ai", "Chat"],
  ["/dashboard", "Dashboard"],
  ["/explorer", "Explorer"],
  ["/features", "Features"],
  ["/timeline", "Timeline"],
  ["/graph", "Graph"],
  ["/analytics", "Analytics"],
  ["/experiments", "Experiments"],
  ["/decisions", "Decisions"],
  ["/settings", "Settings"],
];

function pageTitle(pathname: string) {
  const title = document.title.replace(/\s+[—|-]\s+Kismet$/, "").trim();
  if (title && title !== "Kismet") return title;
  const match = PAGE_LABELS.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[1] ?? pathname;
}

export function WorkWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const main = document.querySelector("main");
      const title = pageTitle(pathname);
      seePage({
        path: pathname,
        title,
        text: compactText(main?.innerText ?? ""),
        at: new Date().toISOString(),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
