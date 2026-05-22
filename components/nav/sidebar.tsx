"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: FolderKanban },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse state
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
        "flex flex-col border-r bg-white shrink-0 transition-all duration-200",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2 border-b", collapsed ? "px-3.5 py-5 justify-center" : "px-4 py-5")}>
        <Zap className="h-5 w-5 text-violet-600 shrink-0" />
        {!collapsed && <span className="font-semibold text-base">Sentinel</span>}
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
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user + collapse toggle */}
      <div className={cn("p-3 border-t flex items-center", collapsed ? "flex-col gap-3 justify-center" : "justify-between")}>
        <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
        <button
          onClick={toggle}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
