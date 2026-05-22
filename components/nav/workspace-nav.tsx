"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Lightbulb,
  Target,
  BookOpen,
  BarChart2,
  MessageSquarePlus,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceNavProps {
  workspaceId: string;
}

export function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;

  const links = [
    { href: base, label: "Overview", icon: BookOpen, exact: true },
    { href: `${base}/documents`, label: "Documents", icon: FileText },
    { href: `${base}/insights`, label: "Insights", icon: Lightbulb },
    { href: `${base}/opportunities`, label: "Opportunities", icon: Target },
    { href: `${base}/prd`, label: "PRDs", icon: FileText },
    { href: `${base}/reports`, label: "Reports", icon: BarChart2 },
    { href: `${base}/interview-guide`, label: "Interview Guide", icon: MessageSquarePlus },
    { href: `${base}/integrations`, label: "Integrations", icon: Plug },
  ];

  return (
    <nav className="flex items-center gap-0.5 border-b border-gray-200 px-4 bg-white shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
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
