"use client";

import { X, AlertTriangle, CheckCircle2, Info, AlertCircle } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useNotificationStore } from "@/stores/notification-store";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertCircle,
};

const COLORS = {
  info: "text-foreground",
  warning: "text-warning",
  success: "text-success",
  error: "text-destructive",
};

export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUIStore();
  const { items, markAsRead, markAllAsRead } = useNotificationStore();
  const unreadCount = items.filter((n) => !n.read).length;

  if (!notificationPanelOpen) return null;

  return (
    <div className="absolute right-4 top-12 z-50 w-96 rounded-lg border border-border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 gap-2">
        <h3 className="text-sm font-medium">Notifications</h3>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setNotificationPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-96">
        <div className="divide-y divide-border">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No notifications
            </p>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!n.read) markAsRead(n.id);
                    }
                  }}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors text-left w-full",
                    !n.read && "bg-accent/30"
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", COLORS[n.type])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <RelativeTime
                        date={n.timestamp}
                        className="text-[10px] text-muted-foreground"
                      />
                      {!n.read && (
                        <button
                          type="button"
                          className="text-[10px] text-foreground/70 hover:text-foreground underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <div className="h-2 w-2 rounded-full bg-foreground shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
