"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Target,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Projects", icon: FolderKanban },
  { href: "/insights", label: "AI Insights", icon: Cpu },
  { href: "/goals", label: "Goals", icon: Target },
];

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
        "flex flex-col shrink-0 transition-all duration-200 bg-gray-950 border-r border-gray-800",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-gray-800",
          collapsed ? "px-3.5 py-5 justify-center" : "px-4 py-5"
        )}
      >
        <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-base text-white tracking-tight">Sentinel</span>
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
                  ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100 border border-transparent"
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
        <div className="mx-2 mb-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-violet-300">AI Agent Active</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-snug">Monitoring 3 projects</p>
        </div>
      )}

      {/* Footer */}
      <div
        className={cn(
          "p-3 border-t border-gray-800 flex items-center",
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
        <button
          onClick={toggle}
          className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
