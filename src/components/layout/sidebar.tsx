"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  Layers,
  Columns3,
  Clock,
  GitBranch,
  BarChart3,
  FlaskConical,
  Scale,
  MessageSquare,
  Settings,
  User,
  LogOut,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Bot,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsFor, readOnboarding } from "@/lib/onboarding";
import { CURRENT_USER } from "@/lib/settings";
import { startNewChat } from "@/lib/chat/session";
import { BrandLogo } from "@/components/marketing/brand-logo";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      { label: "Chat", href: "/ai", icon: MessageSquare },
      { label: "Agents", href: "/agents", icon: Boxes },
      { label: "Autopilot", href: "/autopilot", icon: Bot },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Explorer", href: "/explorer", icon: FolderTree },
      { label: "Features", href: "/features", icon: Layers },
      { label: "Board", href: "/board", icon: Columns3 },
      { label: "Timeline", href: "/timeline", icon: Clock },
      { label: "Graph", href: "/graph", icon: GitBranch },
    ],
  },
  {
    label: "Measure",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Experiments", href: "/experiments", icon: FlaskConical },
      { label: "Decisions", href: "/decisions", icon: Scale },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [profile, setProfile] = useState({
    name: CURRENT_USER.name,
    email: CURRENT_USER.email,
    initials: CURRENT_USER.initials,
  });

  useEffect(() => {
    const draft = readOnboarding();
    if (!draft.name) return;
    setProfile({
      name: draft.name,
      email: draft.email,
      initials: initialsFor(draft.name),
    });
  }, []);

  function handleLogout() {
    router.push("/");
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        sidebarCollapsed ? "w-14" : "w-56"
      )}
    >
      <div className={cn("flex items-center gap-1 px-2 py-2", sidebarCollapsed ? "flex-col" : "h-12 justify-between")}>
        <Link href="/ai" className="min-w-0" aria-label="Kismet">
          {sidebarCollapsed ? (
            <BrandLogo mark priority className="h-7" />
          ) : (
            <BrandLogo tone="auto" priority className="h-7" />
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded-md p-1.5 text-foreground hover:bg-sidebar-accent",
            sidebarCollapsed && "bg-sidebar-accent",
          )}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-0.5 px-2 pb-2">
          <Link
            href="/ai"
            onClick={() => startNewChat()}
            title={sidebarCollapsed ? "New" : undefined}
            className={cn(
              "mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>New</span>}
          </Link>
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              {!sidebarCollapsed && (
                <p className="px-2 pb-1 pt-3 text-[11px] text-muted-foreground">{group.label}</p>
              )}
              {group.items.map((item) => {
                const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                      active ? "bg-accent font-medium text-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
                      sidebarCollapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link
            href="/settings"
            title={sidebarCollapsed ? "Settings" : undefined}
            className={cn(
              "mt-1 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
              pathname.startsWith("/settings") ? "bg-accent font-medium text-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>
        </nav>
      </ScrollArea>

      <Separator />
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                sidebarCollapsed && "justify-center px-0"
              )}
              aria-label="Open profile menu"
              title={sidebarCollapsed ? profile.name : undefined}
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-accent text-[10px] text-accent-foreground">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              {!sidebarCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{profile.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{profile.email}</p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{profile.name}</span>
                <span className="text-xs text-muted-foreground">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
