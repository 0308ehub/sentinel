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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceNavProps {
  workspaceId: string;
}

export function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;

  // Track exact PRD-section URL so the nav link returns to wherever the user
  // actually left — the list, a specific PRD, etc.
  const [prdHref, setPrdHref] = useState(`${base}/prd`);
  useEffect(() => {
    if (pathname.startsWith(`${base}/prd`)) {
      // Currently inside the PRD section: remember this exact page.
      localStorage.setItem(`last-prd:${workspaceId}`, pathname);
      setPrdHref(pathname);
    } else {
      // Outside the PRD section: restore whatever page we left from.
      const saved = localStorage.getItem(`last-prd:${workspaceId}`);
      if (saved) setPrdHref(saved);
    }
  }, [pathname, base, workspaceId]);

  const links = [
    { href: base,                         activeHref: base,                         label: "Overview",       icon: BookOpen,         exact: true },
    { href: `${base}/documents`,          activeHref: `${base}/documents`,          label: "Documents",      icon: FileText },
    { href: `${base}/insights`,           activeHref: `${base}/insights`,           label: "Insights",       icon: Lightbulb },
    { href: `${base}/opportunities`,      activeHref: `${base}/opportunities`,      label: "Opportunities",  icon: Target },
    { href: prdHref,                      activeHref: `${base}/prd`,                label: "PRDs",           icon: FileText },
    { href: `${base}/tickets`,            activeHref: `${base}/tickets`,            label: "Tickets",        icon: Kanban },
    { href: `${base}/reports`,            activeHref: `${base}/reports`,            label: "Reports",        icon: BarChart2 },
    { href: `${base}/interview-guide`,    activeHref: `${base}/interview-guide`,    label: "Interview Guide", icon: MessageSquarePlus },
    { href: `${base}/inbox`,              activeHref: `${base}/inbox`,              label: "Inbox",          icon: Inbox },
    { href: `${base}/integrations`,       activeHref: `${base}/integrations`,       label: "Integrations",   icon: Plug },
  ];

  return (
    <nav className="flex items-center gap-0.5 border-b border-gray-200 px-4 bg-white shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {links.map(({ href, activeHref, label, icon: Icon, exact }) => {
        const active = exact ? pathname === activeHref : pathname.startsWith(activeHref);
        return (
          <Link
            key={activeHref}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
