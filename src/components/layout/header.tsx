"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { useState, useSyncExternalStore } from "react";
import { Bell, CircleAlert, Home, LogOut, Search, Settings, User } from "lucide-react";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/stores/ui-store";
import { useNotificationStore } from "@/stores/notification-store";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { ReportProblem } from "@/components/feedback/report-problem";
import { PresenceAvatar } from "@/components/workspace/presence-avatar";
import { usePresence } from "@/components/workspace/live-sync";
import { useAccount } from "@/lib/auth/use-account";
import { initialsFor, readOnboarding } from "@/lib/onboarding";
import { CURRENT_USER } from "@/lib/settings";

const noSubscribe = () => () => {};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const account = useAccount();
  const presence = usePresence();
  const { setCommandPaletteOpen, notificationPanelOpen, setNotificationPanelOpen } = useUIStore();
  const unreadCount = useNotificationStore((s) => s.items.filter((n) => !n.read).length);
  const draftName = useSyncExternalStore(noSubscribe, () => readOnboarding().name, () => "");
  const draftEmail = useSyncExternalStore(noSubscribe, () => readOnboarding().email, () => "");
  const fallback = draftName
    ? { name: draftName, email: draftEmail, initials: initialsFor(draftName) }
    : { name: CURRENT_USER.name, email: CURRENT_USER.email, initials: CURRENT_USER.initials };
  const profile = account
    ? { name: account.name || fallback.name, email: account.email || fallback.email, initials: initialsFor(account.name || fallback.name) }
    : fallback;
  const online = presence.slice(0, 4);
  const [reporting, setReporting] = useState(false);

  function logout() {
    if (account) {
      void account.signOut();
      return;
    }
    router.push("/");
  }

  return (
    <>
      <header className="flex h-12 items-center justify-end gap-1 border-b border-border bg-background px-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Search"
          title="Search (⌘K)"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
        {online.length > 0 && (
          <div className="flex items-center gap-1.5 px-1.5" title={`${presence.length} online`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="flex -space-x-1">
              {online.map((person) => <PresenceAvatar key={person.userId} person={person} className="h-5 w-5" />)}
            </span>
            <span className="text-[11px] text-muted-foreground">{presence.length} online</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Notifications"
          onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          )}
        </Button>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (
          <OrganizationSwitcher
            hidePersonal={false}
            afterSelectOrganizationUrl={pathname}
            afterSelectPersonalUrl={pathname}
            appearance={{ elements: { organizationSwitcherTrigger: "h-8 max-w-[180px] rounded-md border-0 px-2 text-xs shadow-none hover:bg-accent" } }}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md px-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open profile menu"
            >
              <Avatar className="h-6 w-6">
                {account?.imageUrl && <AvatarPrimitive.Image src={account.imageUrl} alt="" className="h-full w-full object-cover" />}
                <AvatarFallback className="bg-accent text-[10px] text-accent-foreground">{profile.initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{profile.name}</span>
                <span className="text-xs text-muted-foreground">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile"><User className="h-4 w-4" />Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings className="h-4 w-4" />Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/"><Home className="h-4 w-4" />Kismet home</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setReporting(true)}>
              <CircleAlert className="h-4 w-4" />
              Report a problem
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <NotificationPanel />
      <ReportProblem open={reporting} onOpenChange={setReporting} />
    </>
  );
}
