"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Projects", icon: FolderKanban },
];

function SentinelMark({ size = 18 }: { size?: number }) {
  const height = Math.round(size * 60 / 44);
  return (
    <svg width={size} height={height} viewBox="0 0 44 60" fill="none" aria-hidden="true">
      <polygon points="22,1 28,7 22,13 16,7" fill="currentColor" />
      <rect x="13" y="13" width="18" height="9" fill="currentColor" />
      <polygon points="13,22 31,22 34,54 10,54" fill="currentColor" />
      <rect x="3" y="54" width="38" height="6" fill="currentColor" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <div
      className={cn(
        "flex flex-col shrink-0 transition-all duration-200 bg-sidebar border-r border-sidebar-border",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-sidebar-border",
          collapsed ? "px-3.5 py-5 justify-center" : "px-4 py-5"
        )}
      >
        <span className="text-white shrink-0">
          <SentinelMark size={18} />
        </span>
        {!collapsed && (
          <span className="font-semibold text-base text-sidebar-foreground tracking-tight">Sentinel</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                collapsed && "justify-center px-2",
                active
                  ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* AI status badge */}
      {!collapsed && (
        <div className="mx-2 mb-2 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-indigo-300">AI Agent Active</span>
          </div>
          <p className="text-xs text-sidebar-foreground/40 mt-1 leading-snug">Monitoring 3 projects</p>
        </div>
      )}

      {/* Footer */}
      <div
        className={cn(
          "p-3 border-t border-sidebar-border flex items-center",
          collapsed ? "flex-col gap-3 justify-center" : "justify-between"
        )}
      >
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
            },
          }}
        />
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-1")}>
          <ThemeToggle className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent [&_svg]:h-3.5 [&_svg]:w-3.5" />
          <button
            onClick={toggle}
            className="p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
