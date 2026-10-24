"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Shield,
  Plug,
  Bell,
  User,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { label: "General", href: "/settings", icon: Building2, exact: true },
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Security", href: "/settings/security", icon: Shield },
  { label: "Connected apps", href: "/settings/connectors", icon: Plug },
  { label: "Models", href: "/settings/models", icon: Waypoints },
  { label: "Notifications", href: "/settings/notifications", icon: Bell },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-0.5">
      {SETTINGS_NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
