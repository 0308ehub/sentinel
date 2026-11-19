"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  Clock,
  CreditCard,
  FolderKanban,
  KeyRound,
  Link2,
  PanelLeft,
  Plug,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Waypoints,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Organization",
    items: [
      { label: "General", href: "/settings", icon: Building2, exact: true },
      { label: "Connected apps", href: "/settings/connectors", icon: Plug },
      { label: "Plan & billing", href: "/settings/billing", icon: CreditCard },
      { label: "Projects", href: "/settings/projects", icon: FolderKanban },
      { label: "Members", href: "/settings/members", icon: Users },
      { label: "Access & SSO", href: "/settings/access", icon: KeyRound },
      { label: "Content access", href: "/settings/content", icon: Link2 },
      { label: "Usage reports", href: "/settings/usage", icon: BarChart3 },
      { label: "Privacy", href: "/settings/privacy", icon: ShieldAlert },
      { label: "Data retention", href: "/settings/retention", icon: Clock },
      { label: "Navigation", href: "/settings/navigation", icon: PanelLeft },
      { label: "AI", href: "/settings/models", icon: Waypoints },
    ],
  },
  {
    label: "Personal",
    items: [
      { label: "Profile", href: "/settings/profile", icon: User },
      { label: "Security", href: "/settings/security", icon: Shield },
      { label: "Notifications", href: "/settings/notifications", icon: Bell },
      { label: "Agents", href: "/settings/agents", icon: MessageCircle },
      { label: "Year in review", href: "/settings/year", icon: Sparkles },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
