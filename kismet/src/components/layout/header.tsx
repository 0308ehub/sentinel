"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useNotificationStore } from "@/stores/notification-store";
import { NotificationPanel } from "@/components/layout/notification-panel";

export function Header() {
  const { setCommandPaletteOpen, notificationPanelOpen, setNotificationPanelOpen } =
    useUIStore();
  const unreadCount = useNotificationStore(
    (s) => s.items.filter((n) => !n.read).length
  );

  return (
    <>
      <header className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-72 justify-start text-muted-foreground font-normal"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="mr-2 h-3.5 w-3.5" />
          <span className="text-xs">Search graph...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>
      </header>
      <NotificationPanel />
    </>
  );
}
