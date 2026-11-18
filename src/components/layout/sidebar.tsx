"use client";

import Link from "next/link";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  Layers,
  Frame,
  Columns3,
  Clock,
  GitBranch,
  BarChart3,
  FlaskConical,
  MessageSquare,
  Settings,
  User,
  LogOut,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Boxes,
  CircleAlert,
  ChevronRight,
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
import { useWorkspaceSettings } from "@/lib/settings/workspace";
import { startNewChat } from "@/lib/chat/session";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { useAccount } from "@/lib/auth/use-account";
import { ReportProblem } from "@/components/feedback/report-problem";

type NavItem = { id: string; label: string; href: string; icon: typeof MessageSquare };

// What a new user needs: talk to Kismet and see the experiments it runs.
const PRIMARY: NavItem[] = [
  { id: "chat", label: "Chat", href: "/ai", icon: MessageSquare },
  { id: "experiments", label: "Experiments", href: "/experiments", icon: FlaskConical },
  { id: "features", label: "Features", href: "/features", icon: Layers },
  { id: "graph", label: "Graph", href: "/graph", icon: GitBranch },
];

// Everything else stays one click away, and in the command palette.
const MORE: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: BarChart3 },
  { id: "board", label: "Board", href: "/board", icon: Columns3 },
  { id: "timeline", label: "Timeline", href: "/timeline", icon: Clock },
  { id: "design", label: "Design", href: "/design", icon: Frame },
  { id: "explorer", label: "Explorer", href: "/explorer", icon: FolderTree },
  { id: "agents", label: "Agents", href: "/agents", icon: Boxes },
];

const MORE_KEY = "kismet-nav-more-open";
const moreListeners = new Set<() => void>();

function readMoreOpen(): boolean {
  try {
    return localStorage.getItem(MORE_KEY) === "1";
  } catch {
    return false; // Storage blocked: start collapsed.
  }
}

function writeMoreOpen(open: boolean) {
  try {
    localStorage.setItem(MORE_KEY, open ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  moreListeners.forEach((listener) => listener());
}

function subscribeMore(listener: () => void) {
  moreListeners.add(listener);
  return () => {
    moreListeners.delete(listener);
  };
}

const noSubscribe = () => () => {};

function isActive(item: NavItem, pathname: string): boolean {
  return item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
}

function NavLink({ item, pathname, collapsed, badge }: { item: NavItem; pathname: string; collapsed: boolean; badge: number }) {
  return (
    <Link
      href={item.href}
      title={collapsed ? (item.id === "design" ? "Design, alpha" : item.label) : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        isActive(item, pathname) ? "bg-accent font-medium text-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {item.id === "design" && !collapsed && (
        <span className="ml-auto rounded border border-border px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Alpha
        </span>
      )}
      {badge > 0 && <CountBadge count={badge} collapsed={collapsed} />}
    </Link>
  );
}

function CountBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  return (
    <span className={cn(
      "grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground",
      collapsed ? "absolute right-1 top-1 h-2 min-w-2 px-0" : "ml-auto",
    )}>
      {collapsed ? "" : count}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const account = useAccount();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  // Read after hydration so the server and client render the same first frame.
  const draftName = useSyncExternalStore(noSubscribe, () => readOnboarding().name, () => "");
  const draftEmail = useSyncExternalStore(noSubscribe, () => readOnboarding().email, () => "");
  const profile = draftName
    ? { name: draftName, email: draftEmail, initials: initialsFor(draftName) }
    : { name: CURRENT_USER.name, email: CURRENT_USER.email, initials: CURRENT_USER.initials };
  const moreStored = useSyncExternalStore(subscribeMore, readMoreOpen, () => false);
  const [attention, setAttention] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/inbox/attention");
      if (!res.ok) return;
      const body = (await res.json()) as { count?: number };
      if (!stop) setAttention(body.count ?? 0);
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  const workspace = useWorkspaceSettings();
  const hiddenNav = new Set(workspace.hiddenNav);
  const moreItems = MORE.filter((item) => !hiddenNav.has(item.id));
  // The group opens on its own when you are on one of its pages.
  const moreOpen = moreStored || moreItems.some((item) => isActive(item, pathname));
  const shownProfile = account
    ? {
        name: account.name || CURRENT_USER.name,
        email: account.email || CURRENT_USER.email,
        initials: initialsFor(account.name || CURRENT_USER.name),
      }
    : profile;

  function handleLogout() {
    if (account) {
      void account.signOut();
      return;
    }
    router.push("/");
  }

  return (
    <aside
      className={cn(
        // shrink-0: wide pages (like an experiment's results table) must scroll, not squeeze the sidebar.
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
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
          {PRIMARY.filter((item) => !hiddenNav.has(item.id)).map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={sidebarCollapsed} badge={0} />
          ))}
          <button
            type="button"
            onClick={() => writeMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            title={sidebarCollapsed ? "More" : undefined}
            className={cn(
              "relative mt-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", moreOpen && "rotate-90")} />
            {!sidebarCollapsed && <span>More</span>}
            {!moreOpen && attention > 0 && <CountBadge count={attention} collapsed={sidebarCollapsed} />}
          </button>
          {moreOpen && moreItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={sidebarCollapsed}
              badge={item.id === "agents" ? attention : 0}
            />
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
        <ReportProblem>
          <button
            type="button"
            title={sidebarCollapsed ? "Report a problem" : undefined}
            className={cn(
              "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <CircleAlert className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Report a problem</span>}
          </button>
        </ReportProblem>
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
              title={sidebarCollapsed ? shownProfile.name : undefined}
            >
              <Avatar className="h-7 w-7 shrink-0">
                {account?.imageUrl && (
                  <AvatarPrimitive.Image
                    src={account.imageUrl}
                    alt={shownProfile.name}
                    className="h-full w-full object-cover"
                  />
                )}
                <AvatarFallback className="bg-accent text-[10px] text-accent-foreground">
                  {shownProfile.initials}
                </AvatarFallback>
              </Avatar>
              {!sidebarCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{shownProfile.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{shownProfile.email}</p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{shownProfile.name}</span>
                <span className="text-xs text-muted-foreground">{shownProfile.email}</span>
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
