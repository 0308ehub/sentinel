"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Lightbulb,
  Target,
  MessageSquare,
  Upload,
  BookOpen,
  Ticket,
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
    { href: `${base}/chat`, label: "Ask Sentinel", icon: MessageSquare },
  ];

  return (
    <nav className="flex items-center gap-1 border-b px-6 bg-white">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
