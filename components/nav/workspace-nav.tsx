"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FileText,
  Lightbulb,
  Target,
  BookOpen,
  BarChart2,
  MessageSquarePlus,
  Plug,
  Kanban,
  Inbox,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceNavProps {
  workspaceId: string;
}

export function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;
  const [pendingCount, setPendingCount] = useState(0);

  // Track exact PRD-section URL so the nav link returns to wherever the user
  // actually left — the list, a specific PRD, etc.
  const [prdHref, setPrdHref] = useState(`${base}/prd`);
  useEffect(() => {
    if (pathname.startsWith(`${base}/prd`)) {
      localStorage.setItem(`last-prd:${workspaceId}`, pathname);
      setPrdHref(pathname);
    } else {
      const saved = localStorage.getItem(`last-prd:${workspaceId}`);
      if (saved) setPrdHref(saved);
    }
  }, [pathname, base, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchPending() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/sentinel/actions?status=PENDING_REVIEW&limit=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPendingCount(data.total ?? data.actions?.length ?? 0);
      } catch { /* silent */ }
    }
    fetchPending();
    const id = setInterval(fetchPending, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [workspaceId]);

  const links = [
    { href: base,                         activeHref: base,                         label: "Overview",       icon: BookOpen,         exact: true },
    { href: `${base}/documents`,          activeHref: `${base}/documents`,          label: "Documents",      icon: FileText },
    { href: `${base}/insights`,           activeHref: `${base}/insights`,           label: "Insights",       icon: Lightbulb },
    { href: `${base}/opportunities`,      activeHref: `${base}/opportunities`,      label: "Opportunities",  icon: Target },
    { href: prdHref,                      activeHref: `${base}/prd`,                label: "PRDs",           icon: FileText },
    { href: `${base}/tickets`,            activeHref: `${base}/tickets`,            label: "Tickets",        icon: Kanban },
    { href: `${base}/search`,             activeHref: `${base}/search`,             label: "Search",         icon: Search },
    { href: `${base}/reports`,            activeHref: `${base}/reports`,            label: "Reports",        icon: BarChart2 },
    { href: `${base}/interview-guide`,    activeHref: `${base}/interview-guide`,    label: "Interview Guide", icon: MessageSquarePlus },
    { href: `${base}/inbox`,              activeHref: `${base}/inbox`,              label: "Inbox",          icon: Inbox,            badge: pendingCount },
    { href: `${base}/integrations`,       activeHref: `${base}/integrations`,       label: "Integrations",   icon: Plug },
  ];

  return (
    <nav className="flex items-center gap-0.5 border-b border-border px-4 bg-card shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {links.map(({ href, activeHref, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === activeHref : pathname.startsWith(activeHref);
        return (
          <Link
            key={activeHref}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-violet-600 text-violet-700 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            {badge != null && badge > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
